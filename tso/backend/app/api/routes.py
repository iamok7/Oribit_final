from flask import request, jsonify
from app import db
from app.models import User, Department, Project, Task, Subtask, Issue, Comment, Expense, Notification, Company
from app.api import bp
from datetime import datetime, timedelta, date


def _notify(user_id, ntype, title, body, ref_id=None, ref_type=None):
    """Create a notification row (caller must db.session.commit)."""
    n = Notification(
        user_id=user_id, type=ntype, title=title, body=body,
        ref_id=ref_id, ref_type=ref_type,
    )
    db.session.add(n)


def _resolve_co_assignees(co_assignees_str):
    if not co_assignees_str:
        return []
    ids = [int(x) for x in co_assignees_str.split(',') if x.strip().isdigit()]
    if not ids:
        return []
    users = User.query.filter(User.id.in_(ids)).all()
    return [{'id': u.id, 'username': u.username} for u in users]


def _pack_co_assignees(raw):
    if isinstance(raw, list):
        return ','.join(str(int(x)) for x in raw if str(x).strip().isdigit()) or None
    return str(raw) if raw else None

# ... existing routes ...

@bp.route('/departments/<int:dept_id>/projects', methods=['POST'])
def create_project(dept_id):
# ... we will just prepend the imports to the file ...
    department = Department.query.get_or_404(dept_id)
    data = request.get_json()
    
    if not data or not 'name' in data:
        return jsonify({'message': 'Project name is required'}), 400
        
    project = Project(name=data['name'], department_id=department.id)
    db.session.add(project)
    db.session.commit()
    
    return jsonify({'message': 'Project created successfully', 'project': {'id': project.id, 'name': project.name}}), 201

@bp.route('/departments/<int:dept_id>/projects', methods=['GET'])
def get_projects(dept_id):
    department = Department.query.filter_by(id=dept_id, is_deleted=False).first_or_404()
    projects = Project.query.filter_by(department_id=department.id, is_deleted=False).all()
    
    proj_list = []
    for proj in projects:
        proj_data = {
            'id': proj.id,
            'name': proj.name,
            'lead': {'id': proj.lead.id, 'username': proj.lead.username} if proj.lead else None,
            'members': [{'id': u.id, 'username': u.username} for u in proj.members]
        }
        proj_list.append(proj_data)
        
    return jsonify(proj_list), 200

@bp.route('/projects/<int:proj_id>/assign', methods=['PUT'])
def assign_project_members(proj_id):
    project = Project.query.get_or_404(proj_id)
    data = request.get_json()
    
    lead_id = data.get('lead_id')
    member_ids = data.get('member_ids', [])
    
    if lead_id:
        lead = User.query.get(lead_id)
        if not lead:
             return jsonify({'message': 'Lead not found.'}), 404
        project.lead_id = lead.id
    else:
        # If lead_id is explicitly empty/null, remove lead
        project.lead_id = None
    
    # Update members list (replacing current members)
    project.members = [] # Clear existing
    
    # Ensure lead is always in the members list
    if lead_id:
        lead = User.query.get(lead_id)
        if lead and str(lead.id) not in [str(m) for m in member_ids]:
            project.members.append(lead)
            
    for mem_id in member_ids:
        mem = User.query.get(mem_id)
        if mem:
            project.members.append(mem)
            
    db.session.commit()
    return jsonify({'message': 'Project assignments updated successfully'}), 200

@bp.route('/users', methods=['GET'])
def get_users_by_role():
    role = request.args.get('role')
    unassigned_only = request.args.get('unassigned_only', 'false').lower() == 'true'
    company_id = request.args.get('company_id', type=int)

    query = User.query.filter_by(is_active=True)

    # Isolate by company: only show users in the same company
    if company_id:
        query = query.filter_by(company_id=company_id)
    else:
        # Don't expose individual users or users from other companies
        query = query.filter(User.company_id.is_(None))

    if role:
        query = query.filter_by(role=role)

    if unassigned_only:
        query = query.filter(User.department_id.is_(None))

    users = query.all()
    user_list = [
        {
            'id': u.id,
            'username': u.username,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'role': u.role,
            'department_id': u.department_id,
            'user_type': u.user_type,
        }
        for u in users
    ]

    return jsonify(user_list), 200

@bp.route('/users/<int:user_id>', methods=['GET'])
def get_user_details(user_id):
    user = User.query.get_or_404(user_id)
    
    # Calculate allocated projects
    # Memberships + Led projects (unique)
    project_ids = set([p.id for p in user.projects] + [p.id for p in user.led_projects])
    
    # Calculate allocated tasks (not deleted)
    task_count = Task.query.filter_by(assigned_to=user.id, is_deleted=False).count()
    
    return jsonify({
        'id': user.id,
        'username': user.username,
        'role': user.role,
        'department_id': user.department_id,
        'allocated_projects_count': len(project_ids),
        'allocated_tasks_count': task_count
    }), 200

@bp.route('/users/<int:user_id>/department', methods=['PUT'])
def allocate_user_department(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    
    # Accept department_id. If missing or explicitly None/'', unset it.
    dept_id = data.get('department_id')
    
    if dept_id:
        dept = Department.query.get_or_404(dept_id)
        
        # If the user is a supervisor and being assigned, 
        # ensure we don't accidentally create multiple supervisors per department
        # unless the business logic allows it. The existing assign_members logic
        # strictly unassigns the old supervisor if a new one is set.
        if user.role == 'supervisor':
            existing_sup = User.query.filter_by(department_id=dept.id, role='supervisor').first()
            if existing_sup and existing_sup.id != user.id:
                 existing_sup.department_id = None
                 
        user.department_id = dept.id
    else:
        user.department_id = None
        
    db.session.commit()
    return jsonify({'message': 'User department updated successfully'}), 200

@bp.route('/users/<int:user_id>', methods=['DELETE'])
def deactivate_user(user_id):
    user = User.query.get_or_404(user_id)
    # Soft delete to preserve foreign key history
    user.is_active = False
    
    # Remove from current projects and departments to free up slots
    user.department_id = None
    user.projects = []
    for project in user.led_projects:
        project.lead_id = None
        
    # Unassign active tasks
    for task in Task.query.filter_by(assigned_to=user.id, is_deleted=False).all():
        if task.status != 'Completed':
             task.assigned_to = None
             
    db.session.commit()
    return jsonify({'message': 'User deactivated successfully'}), 200


@bp.route('/activity', methods=['GET'])
def get_recent_activity():
    """Return recent task activity: tasks in 'In Progress' or 'Completed' with assignee info."""
    limit = int(request.args.get('limit', 20))

    # Get tasks in active statuses, sorted by most recently created
    tasks = (
        Task.query
        .filter(Task.is_deleted == False, Task.assigned_to != None,
                Task.status.in_(['In Progress', 'Completed', 'To Do']))
        .order_by(Task.created_on.desc())
        .limit(limit * 3)
        .all()
    )

    activity = []
    seen = set()
    for t in tasks:
        if not t.assignee:
            continue
        key = (t.id, t.status)
        if key in seen:
            continue
        seen.add(key)
        activity.append({
            'task_id': t.id,
            'task_title': t.title,
            'status': t.status,
            'username': t.assignee.username,
            'user_id': t.assignee.id,
            'timestamp': t.created_on.isoformat() if t.created_on else None,
        })
        if len(activity) >= limit:
            break

    return jsonify(activity), 200


@bp.route('/stats/employees', methods=['GET'])
def get_employee_stats():
    """Return employee stats: role distribution, department distribution, task status breakdown."""
    company_id = request.args.get('company_id', type=int)

    user_query = User.query.filter_by(is_active=True)
    if company_id:
        user_query = user_query.filter_by(company_id=company_id)

    users = user_query.all()

    # Role distribution
    role_counts = {}
    for u in users:
        role_counts[u.role] = role_counts.get(u.role, 0) + 1

    # Department distribution (scoped to company)
    dept_query = Department.query.filter_by(is_deleted=False)
    if company_id:
        dept_query = dept_query.filter_by(company_id=company_id)
    departments = dept_query.all()

    dept_dist = []
    for d in departments:
        count = User.query.filter_by(department_id=d.id, is_active=True).count()
        if count > 0:
            dept_dist.append({'name': d.name, 'count': count})
    unassigned = user_query.filter(User.department_id.is_(None)).count()
    if unassigned > 0:
        dept_dist.append({'name': 'Unassigned', 'count': unassigned})

    # Task status breakdown across all employees
    task_status = {}
    for status in ['To Do', 'In Progress', 'Completed']:
        task_status[status] = Task.query.filter_by(status=status, is_deleted=False).count()

    return jsonify({
        'total': len(users),
        'role_distribution': [{'role': k, 'count': v} for k, v in role_counts.items()],
        'dept_distribution': dept_dist,
        'task_status': [{'status': k, 'count': v} for k, v in task_status.items()],
    }), 200


@bp.route('/departments', methods=['POST'])
def create_department():
    data = request.get_json()
    if not data or not 'name' in data:
        return jsonify({'message': 'Department name is required'}), 400

    company_id = data.get('company_id')

    # Unique per company (or globally if no company)
    existing = Department.query.filter_by(name=data['name'], company_id=company_id, is_deleted=False).first()
    if existing:
        return jsonify({'message': 'Department already exists'}), 400

    department = Department(name=data['name'], company_id=company_id)
    db.session.add(department)
    db.session.commit()

    return jsonify({'message': 'Department created successfully', 'department': {'id': department.id, 'name': department.name}}), 201

@bp.route('/departments', methods=['GET'])
def list_departments():
    company_id = request.args.get('company_id', type=int)

    query = Department.query.filter_by(is_deleted=False)
    if company_id:
        query = query.filter_by(company_id=company_id)

    departments = query.all()
    dep_list = []

    for dep in departments:
        members = User.query.filter_by(department_id=dep.id).all()
        dep_data = {
            'id': dep.id,
            'name': dep.name,
            'supervisor': next(({'id': u.id, 'username': u.username} for u in members if u.role == 'supervisor'), None),
            'employees': [{'id': u.id, 'username': u.username} for u in members if u.role == 'employee']
        }
        dep_list.append(dep_data)

    return jsonify(dep_list), 200

@bp.route('/departments/<int:id>/assign', methods=['PUT'])
def assign_members(id):
    department = Department.query.get_or_404(id)
    data = request.get_json()
    
    supervisor_id = data.get('supervisor_id')
    employee_ids = data.get('employee_ids', [])
    
    # Optional logic: clear existing assignments if needed before reassigning
    # For now, this just assigns the given users. A more robust implementation 
    # might remove users who are no longer in the list.
    
    # 1. Clear current members if we want a strict update (optional)
    # User.query.filter_by(department_id=department.id).update({'department_id': None})
    
    if supervisor_id:
        supervisor = User.query.filter_by(id=supervisor_id, role='supervisor').first()
        if supervisor:
             # Remove any existing supervisor from this department first (if strictly one per dep)
             existing_sup = User.query.filter_by(department_id=department.id, role='supervisor').first()
             if existing_sup and existing_sup.id != supervisor.id:
                 existing_sup.department_id = None
             supervisor.department_id = department.id
             
    for emp_id in employee_ids:
        emp = User.query.filter_by(id=emp_id, role='employee').first()
        if emp:
            emp.department_id = department.id
            
    db.session.commit()
    return jsonify({'message': 'Department members updated successfully'}), 200
@bp.route('/projects', methods=['GET'])
def get_user_projects():
    user_id = request.args.get('user_id', type=int)
    role = request.args.get('role')
    
    if not user_id or not role:
        return jsonify({'message': 'user_id and role required'}), 400
        
    user = User.query.get_or_404(user_id)
    query = Project.query.filter_by(is_deleted=False)
    
    if role == 'manager':
        projects = query.all()
    elif role == 'supervisor':
        projects = query.filter_by(department_id=user.department_id).all()
    else: # employee
        # Employee sees projects they are a member of or lead
        projects = query.filter(Project.members.any(id=user.id) | (Project.lead_id == user.id)).all()
        
    project_list = []
    for p in projects:
        project_list.append({
            'id': p.id,
            'name': p.name,
            'department_id': p.department_id,
            'lead_id': p.lead_id
        })
        
    return jsonify(project_list), 200

# --- Task Management Endpoints ---

@bp.route('/tasks', methods=['GET'])
def get_tasks():
    user_id = request.args.get('user_id', type=int)
    role = request.args.get('role')
    project_id = request.args.get('project_id', type=int)
    scope = request.args.get('scope', 'all')   # all | self | team | department
    dept_id = request.args.get('dept_id', type=int)

    if not user_id or not role:
        return jsonify({'message': 'user_id and role required'}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404

    # Individual users only see their own tasks (no company tasks)
    if user.user_type == 'individual':
        tasks = Task.query.filter_by(is_deleted=False).filter(
            (Task.assigned_to == user.id) | (Task.created_by == user.id)
        ).all()
        task_list = []
        for t in tasks:
            task_list.append({
                'id': t.id,
                'title': t.title,
                'description': t.description,
                'status': t.status,
                'deadline': t.deadline.isoformat() if t.deadline else None,
                'start_time': t.start_time.isoformat() if t.start_time else None,
                'is_daily_task': t.is_daily_task,
                'created_on': t.created_on.isoformat() if t.created_on else None,
                'assigned_to': {'id': t.assignee.id, 'username': t.assignee.username} if t.assignee else None,
                'created_by': {'id': t.creator.id, 'username': t.creator.username} if t.creator else None,
                'priority': t.priority or 'medium',
                'project_id': t.project_id,
                'tags': [x.strip() for x in t.tags.split(',') if x.strip()] if t.tags else [],
                'co_assignees': [],
                'image_attachment': t.image_attachment,
            })
        return jsonify(task_list), 200

    query = Task.query.filter_by(is_deleted=False)
    if project_id:
        query = query.filter_by(project_id=project_id)

    # Scope filter overrides role-based logic when explicitly set
    if scope == 'self':
        tasks = query.filter(Task.assigned_to == user.id).all()
    elif scope == 'team':
        # project_id already applied to query above when provided
        if project_id:
            tasks = query.all()
        else:
            my_projects = Project.query.filter(
                Project.members.any(id=user.id) | (Project.lead_id == user.id)
            ).all()
            my_project_ids = [p.id for p in my_projects]
            tasks = query.filter(Task.project_id.in_(my_project_ids)).all() if my_project_ids else []
    elif scope == 'department':
        # Use provided dept_id, or fall back to user's own department
        target_dept_id = dept_id or user.department_id
        dept_users = User.query.filter_by(department_id=target_dept_id).all()
        dept_user_ids = [u.id for u in dept_users]
        dept_projects = Project.query.filter_by(department_id=target_dept_id).all()
        dept_project_ids = [p.id for p in dept_projects]
        tasks = query.filter(
            Task.assigned_to.in_(dept_user_ids) |
            Task.project_id.in_(dept_project_ids)
        ).all()
    elif role == 'manager':
        # Manager sees all tasks matching query
        tasks = query.all()
    elif role == 'supervisor':
        # Supervisor sees tasks assigned to users in their department OR tasks in projects under their dept
        dept_users = User.query.filter_by(department_id=user.department_id).all()
        dept_user_ids = [u.id for u in dept_users]

        # Also include tasks from projects within the supervisor's department
        dept_projects = Project.query.filter_by(department_id=user.department_id).all()
        dept_project_ids = [p.id for p in dept_projects]

        tasks = query.filter(
            Task.assigned_to.in_(dept_user_ids) |
            (Task.assigned_to == None) |
            Task.project_id.in_(dept_project_ids)
        ).all()
    else:
        # Employee sees their own tasks, unassigned tasks in their department, OR tasks in projects they are a member/lead of
        dept_users = User.query.filter_by(department_id=user.department_id).all()
        dept_user_ids = [u.id for u in dept_users]

        # Get projects user is involved in
        my_projects = Project.query.filter(Project.members.any(id=user.id) | (Project.lead_id == user.id)).all()
        my_project_ids = [p.id for p in my_projects]

        tasks = query.filter(
            (Task.assigned_to == user.id) |
            ((Task.assigned_to == None) & Task.created_by.in_(dept_user_ids)) |
            Task.project_id.in_(my_project_ids)
        ).all()

    task_list = []
    for t in tasks:
        task_list.append({
            'id': t.id,
            'title': t.title,
            'description': t.description,
            'status': t.status,
            'deadline': t.deadline.isoformat() if t.deadline else None,
            'start_time': t.start_time.isoformat() if t.start_time else None,
            'is_daily_task': t.is_daily_task,
            'created_on': t.created_on.isoformat() if t.created_on else None,
            'assigned_to': {'id': t.assignee.id, 'username': t.assignee.username} if t.assignee else None,
            'created_by': {'id': t.creator.id, 'username': t.creator.username} if t.creator else None,
            'priority': t.priority or 'medium',
            'project_id': t.project_id,
            'tags': [x.strip() for x in t.tags.split(',') if x.strip()] if t.tags else [],
            'co_assignees': _resolve_co_assignees(t.co_assignees),
            'image_attachment': t.image_attachment,
        })
        
    return jsonify(task_list), 200

@bp.route('/tasks', methods=['POST'])
def create_task():
    data = request.get_json()
    
    if not data or not 'title' in data or not 'created_by' in data:
        return jsonify({'message': 'title and created_by required'}), 400

    creator = User.query.get(data['created_by'])
    if not creator:
        return jsonify({'message': 'Creator not found'}), 404

    assigned_to = data.get('assigned_to')
    
    # Enforce assignment rules on creation
    if assigned_to:
        assignee = User.query.get(assigned_to)
        if not assignee:
             return jsonify({'message': 'Assignee not found'}), 404
             
        # Check Project Lead permissions
        is_project_lead = False
        if data.get('project_id'):
            project = Project.query.get(data['project_id'])
            if project and project.lead_id == creator.id:
                # Is lead, check if assignee is a member of the project
                if assignee in project.members and assignee.id != creator.id:
                    is_project_lead = True

        if not is_project_lead:
            if creator.role == 'supervisor' and assignee.department_id != creator.department_id:
                 return jsonify({'message': 'Supervisors can only assign tasks within their department.'}), 403
                 
            if creator.role == 'employee' and assigned_to != creator.id:
                 return jsonify({'message': 'Employees can only self-assign tasks unless they are the Project Lead.'}), 403

    deadline_obj = None
    if data.get('deadline'):
        try:
            deadline_obj = datetime.fromisoformat(data['deadline'].replace('Z', '+00:00'))
        except ValueError:
            pass # Ignore invalid dates for now
            
    start_time_obj = None
    if data.get('start_time'):
        try:
            start_time_obj = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
        except ValueError:
            pass

    # Handle tags - accept list or comma-separated string
    tags_raw = data.get('tags', [])
    if isinstance(tags_raw, list):
        tags_str = ','.join([t.strip() for t in tags_raw if t.strip()]) or None
    else:
        tags_str = tags_raw if tags_raw else None

    task = Task(
        title=data['title'],
        description=data.get('description'),
        status=data.get('status', 'To Do'),
        deadline=deadline_obj,
        start_time=start_time_obj,
        is_daily_task=data.get('is_daily_task', False),
        assigned_to=assigned_to,
        created_by=creator.id,
        project_id=data.get('project_id'),
        tags=tags_str,
        priority=data.get('priority', 'medium'),
        co_assignees=_pack_co_assignees(data.get('co_assignees', [])),
        image_attachment=data.get('image_attachment'),
    )
    db.session.add(task)
    db.session.commit()

    # Notify assignee if different from creator
    if task.assigned_to and task.assigned_to != task.created_by:
        _notify(
            task.assigned_to, 'task_assigned',
            f'New task assigned to you',
            f'{creator.username} assigned: {task.title[:80]}',
            ref_id=task.id, ref_type='task',
        )
        db.session.commit()

    return jsonify({'message': 'Task created', 'task_id': task.id}), 201

@bp.route('/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.get_json()
    
    user_id = data.get('user_id') # The user making the change
    if not user_id:
         return jsonify({'message': 'user_id required for tracking changes.'}), 400
    user = User.query.get(user_id)

    # Capture old status before any updates
    old_status = task.status

    # Update simple fields
    if 'title' in data: task.title = data['title']
    if 'description' in data: task.description = data['description']
    if 'status' in data: task.status = data['status']
    
    if 'deadline' in data:
        if data['deadline'] is None:
            task.deadline = None
        else:
            try:
                task.deadline = datetime.fromisoformat(data['deadline'].replace('Z', '+00:00'))
            except ValueError:
                pass
                
    if 'start_time' in data:
        if data['start_time'] is None:
            task.start_time = None
        else:
            try:
                task.start_time = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
            except ValueError:
                pass
                
    if 'is_daily_task' in data:
        task.is_daily_task = data['is_daily_task']

    if 'tags' in data:
        tags_raw = data['tags']
        if isinstance(tags_raw, list):
            task.tags = ','.join([t.strip() for t in tags_raw if t.strip()]) or None
        else:
            task.tags = tags_raw if tags_raw else None

    if 'priority' in data:
        task.priority = data['priority']

    if 'co_assignees' in data:
        task.co_assignees = _pack_co_assignees(data['co_assignees'])

    if 'image_attachment' in data:
        task.image_attachment = data['image_attachment']

    # Update Assignment with rules
    if 'assigned_to' in data:
        new_assignee_id = data['assigned_to']
        
        if new_assignee_id is None:
             # Unassigning
             if user.role == 'employee' and task.assigned_to != user.id:
                  return jsonify({'message': 'Employees cannot unassign tasks assigned to others.'}), 403
             task.assigned_to = None
        else:
             # Assigning
             assignee = User.query.get(new_assignee_id)
             if not assignee:
                  return jsonify({'message': 'Assignee not found'}), 404
                  
             # Check Project Lead permissions
             is_project_lead = False
             if task.project_id:
                 project = Project.query.get(task.project_id)
                 if project and project.lead_id == user.id:
                     if assignee in project.members and assignee.id != user.id:
                         is_project_lead = True

             if not is_project_lead:
                 if user.role == 'supervisor' and assignee.department_id != user.department_id:
                      return jsonify({'message': 'Supervisors can only assign tasks within their department.'}), 403
                      
                 if user.role == 'employee' and new_assignee_id != user.id:
                      return jsonify({'message': 'Employees can only self-assign tasks unless they are the Project Lead.'}), 403
                  
             task.assigned_to = new_assignee_id

    db.session.commit()

    # Notify on status change: inform creator + all managers (if changer is not manager)
    new_status = task.status
    if 'status' in data and new_status != old_status:
        notified = set()
        # Notify task creator
        if task.created_by and task.created_by != user_id:
            _notify(
                task.created_by, 'task_status',
                f'Task status updated',
                f'{user.username} moved "{task.title[:50]}" → {new_status}',
                ref_id=task.id, ref_type='task',
            )
            notified.add(task.created_by)
        # Notify all managers if changer is employee or supervisor
        if user and user.role in ('employee', 'supervisor'):
            managers = User.query.filter_by(role='manager', is_active=True).all()
            for mgr in managers:
                if mgr.id != user_id and mgr.id not in notified:
                    _notify(
                        mgr.id, 'task_status',
                        f'Task status updated',
                        f'{user.username} moved "{task.title[:50]}" → {new_status}',
                        ref_id=task.id, ref_type='task',
                    )
                    notified.add(mgr.id)
        db.session.commit()

    return jsonify({'message': 'Task updated successfully'}), 200

# --- Task Details (Subtasks, Issues, Comments) ---

@bp.route('/tasks/<int:task_id>/details', methods=['GET'])
def get_task_details(task_id):
    task = Task.query.get_or_404(task_id)

    # Latest task fields (so mobile can refresh deadline/status without a separate endpoint)
    task_data = {
        'id': task.id,
        'title': task.title,
        'description': task.description,
        'status': task.status,
        'deadline': task.deadline.isoformat() if task.deadline else None,
        'start_time': task.start_time.isoformat() if task.start_time else None,
        'priority': task.priority or 'medium',
        'is_daily_task': task.is_daily_task,
        'tags': [x.strip() for x in task.tags.split(',') if x.strip()] if task.tags else [],
        'assigned_to': {'id': task.assignee.id, 'username': task.assignee.username} if task.assignee else None,
        'created_by': {'id': task.creator.id, 'username': task.creator.username} if task.creator else None,
    }

    # Subtasks
    subtasks = [{'id': st.id, 'title': st.title, 'is_completed': st.is_completed} for st in task.subtasks.order_by(Subtask.created_at).all()]
    
    # Issues
    issues = []
    for issue in task.issues.order_by(Issue.created_at.desc()).all():
        issues.append({
            'id': issue.id,
            'title': issue.title,
            'description': issue.description,
            'deadline': issue.deadline.isoformat() if issue.deadline else None,
            'is_resolved': issue.is_resolved,
            'created_by': {'id': issue.creator.id, 'username': issue.creator.username} if issue.creator else None,
            'created_at': issue.created_at.isoformat()
        })
        
    # Comments
    comments = []
    for comment in task.comments.order_by(Comment.created_at).all():
        comments.append({
            'id': comment.id,
            'content': comment.content,
            'image_attachment': comment.image_attachment,
            'user': {'id': comment.user.id, 'username': comment.user.username, 'role': comment.user.role} if comment.user else None,
            'created_at': comment.created_at.isoformat()
        })
        
    return jsonify({
        'task': task_data,
        'subtasks': subtasks,
        'issues': issues,
        'comments': comments
    }), 200

@bp.route('/tasks/<int:task_id>/subtasks', methods=['POST'])
def create_subtask(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.get_json()
    
    if not data or not 'title' in data:
         return jsonify({'message': 'title required'}), 400
         
    st = Subtask(title=data['title'], task_id=task.id)
    db.session.add(st)
    db.session.commit()
    
    return jsonify({'message': 'Subtask created', 'id': st.id}), 201

@bp.route('/subtasks/<int:subtask_id>', methods=['PUT'])
def update_subtask(subtask_id):
    st = Subtask.query.get_or_404(subtask_id)
    data = request.get_json()
    
    if 'is_completed' in data:
         st.is_completed = data['is_completed']
         
    if 'title' in data:
         st.title = data['title']
         
    db.session.commit()
    return jsonify({'message': 'Subtask updated'}), 200

@bp.route('/tasks/<int:task_id>/issues', methods=['POST'])
def create_issue(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.get_json()
    
    if not data or not 'title' in data or not 'created_by' in data:
         return jsonify({'message': 'title and created_by required'}), 400
         
    deadline_obj = None
    if data.get('deadline'):
        try:
            deadline_obj = datetime.fromisoformat(data['deadline'].replace('Z', '+00:00'))
        except ValueError:
            pass
            
    issue = Issue(
        title=data['title'],
        description=data.get('description'),
        deadline=deadline_obj,
        task_id=task.id,
        created_by=data['created_by']
    )
    
    db.session.add(issue)
    db.session.commit()
    return jsonify({'message': 'Issue created', 'id': issue.id}), 201

@bp.route('/issues/<int:issue_id>', methods=['PUT'])
def update_issue(issue_id):
    issue = Issue.query.get_or_404(issue_id)
    data = request.get_json()
    
    if 'is_resolved' in data:
         issue.is_resolved = data['is_resolved']
    if 'title' in data: issue.title = data['title']
    if 'description' in data: issue.description = data['description']
         
    db.session.commit()
    return jsonify({'message': 'Issue updated'}), 200

@bp.route('/tasks/<int:task_id>/comments', methods=['POST'])
def create_comment(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.get_json()
    
    if not data or 'user_id' not in data:
        return jsonify({'message': 'user_id required'}), 400
    if not data.get('content') and not data.get('image_attachment'):
        return jsonify({'message': 'content or image_attachment required'}), 400

    comment = Comment(
        content=data.get('content', ''),
        image_attachment=data.get('image_attachment'),
        task_id=task.id,
        user_id=data['user_id']
    )
    
    db.session.add(comment)
    db.session.commit()

    commenter = User.query.get(data['user_id'])
    snippet = (comment.content[:80] if comment.content else '[image]')
    body_text = f'{commenter.username}: {snippet}' if commenter else snippet
    notified = set()
    # Notify task assignee
    if task.assigned_to and task.assigned_to != data['user_id']:
        _notify(task.assigned_to, 'task_comment',
                f'New comment on "{task.title[:50]}"',
                body_text, ref_id=task.id, ref_type='task')
        notified.add(task.assigned_to)
    # Notify task creator
    if task.created_by and task.created_by != data['user_id'] and task.created_by not in notified:
        _notify(task.created_by, 'task_comment',
                f'New comment on "{task.title[:50]}"',
                body_text, ref_id=task.id, ref_type='task')
    db.session.commit()

    return jsonify({'message': 'Comment added', 'id': comment.id}), 201

@bp.route('/projects/<int:project_id>/members', methods=['GET'])
def get_project_members(project_id):
    project = Project.query.get_or_404(project_id)
    
    members_list = []
    # Add the team lead if one is set
    if project.lead:
        members_list.append({
            'id': project.lead.id,
            'username': project.lead.username,
            'role': project.lead.role,
            'is_lead': True
        })
        
        # Add all standard members
    for member in project.members:
        members_list.append({
            'id': member.id,
            'username': member.username,
            'role': member.role,
            'is_lead': False
        })
        
    return jsonify(members_list), 200

# --- Soft Delete and Recovery Endpoints ---

@bp.route('/departments/<int:id>', methods=['DELETE'])
def delete_department(id):
    department = Department.query.get_or_404(id)
    
    department.is_deleted = True
    for proj in department.projects:
        proj.is_deleted = True
        for task in proj.tasks:
            task.is_deleted = True
        proj.members = []
    
    db.session.commit()
    return jsonify({'message': 'Department deleted successfully'}), 200

@bp.route('/projects/<int:id>', methods=['DELETE'])
def delete_project(id):
    project = Project.query.get_or_404(id)
    project.is_deleted = True
    for task in project.tasks:
        task.is_deleted = True
    project.members = []
    db.session.commit()
    return jsonify({'message': 'Project deleted successfully'}), 200

@bp.route('/tasks/<int:id>', methods=['DELETE'])
def delete_task(id):
    task = Task.query.get_or_404(id)
    task.is_deleted = True
    db.session.commit()
    return jsonify({'message': 'Task deleted successfully'}), 200

@bp.route('/scrapped', methods=['GET'])
def get_scrapped_elements():
    departments = Department.query.filter_by(is_deleted=True).all()
    projects = Project.query.filter_by(is_deleted=True).all()
    tasks = Task.query.filter_by(is_deleted=True).all()
    
    return jsonify({
        'departments': [{'id': d.id, 'name': d.name} for d in departments],
        'projects': [{'id': p.id, 'name': p.name, 'department_id': p.department_id} for p in projects],
        'tasks': [{'id': t.id, 'title': t.title, 'project_id': t.project_id} for t in tasks]
    }), 200

@bp.route('/recover/departments/<int:id>', methods=['PUT'])
def recover_department(id):
    department = Department.query.get_or_404(id)
    department.is_deleted = False
    
    for proj in department.projects:
        proj.is_deleted = False
        for task in proj.tasks:
            task.is_deleted = False
            
    db.session.commit()
    return jsonify({'message': 'Department recovered'}), 200

@bp.route('/recover/projects/<int:id>', methods=['PUT'])
def recover_project(id):
    project = Project.query.get_or_404(id)
    project.is_deleted = False
    
    if project.department and project.department.is_deleted:
        project.department.is_deleted = False
        
    for task in project.tasks:
        task.is_deleted = False
        
    db.session.commit()
    return jsonify({'message': 'Project recovered'}), 200

@bp.route('/recover/tasks/<int:id>', methods=['PUT'])
def recover_task(id):
    task = Task.query.get_or_404(id)
    task.is_deleted = False
    
    if task.project and task.project.is_deleted:
        task.project.is_deleted = False
        if task.project.department and task.project.department.is_deleted:
             task.project.department.is_deleted = False
             
    db.session.commit()
    return jsonify({'message': 'Task recovered'}), 200

@bp.route('/departments/<int:dept_id>/members/<int:user_id>', methods=['DELETE'])
def remove_department_member(dept_id, user_id):
    department = Department.query.get_or_404(dept_id)
    user = User.query.get_or_404(user_id)
    
    if user.department_id == department.id:
        user.department_id = None
        db.session.commit()
        return jsonify({'message': 'Member removed from department'}), 200
    return jsonify({'message': 'User is not a member of this department'}), 400

@bp.route('/projects/<int:proj_id>/members/<int:user_id>', methods=['DELETE'])
def remove_project_member(proj_id, user_id):
    project = Project.query.get_or_404(proj_id)
    user = User.query.get_or_404(user_id)

    if user in project.members:
        project.members.remove(user)
        db.session.commit()
        return jsonify({'message': 'Member removed from project'}), 200

    if project.lead_id == user.id:
        project.lead_id = None
        db.session.commit()
        return jsonify({'message': 'Lead removed from project'}), 200

    return jsonify({'message': 'User is not a member or lead of this project'}), 400


@bp.route('/stats/manager-dashboard', methods=['GET'])
def get_manager_dashboard_stats():
    """Comprehensive manager dashboard stats scoped to a company."""
    company_id = request.args.get('company_id', type=int)

    def user_q():
        q = User.query.filter_by(is_active=True)
        if company_id:
            q = q.filter_by(company_id=company_id)
        return q

    def dept_q():
        q = Department.query.filter_by(is_deleted=False)
        if company_id:
            q = q.filter_by(company_id=company_id)
        return q

    company_user_ids = [u.id for u in user_q().all()] if company_id else None

    def task_q():
        q = Task.query.filter_by(is_deleted=False)
        if company_user_ids is not None:
            q = q.filter(
                Task.assigned_to.in_(company_user_ids) |
                Task.created_by.in_(company_user_ids)
            )
        return q

    # Basic counts
    total_users = user_q().count()
    total_departments = dept_q().count()
    total_projects = Project.query.filter_by(is_deleted=False).count()

    # Task counts
    task_todo = task_q().filter_by(status='To Do').count()
    task_inprogress = task_q().filter_by(status='In Progress').count()
    task_completed = task_q().filter_by(status='Completed').count()
    total_tasks = task_todo + task_inprogress + task_completed

    # Expense stats (scoped to company users)
    expense_q = Expense.query
    if company_user_ids is not None:
        expense_q = expense_q.filter(Expense.created_by_id.in_(company_user_ids))
    total_expense_paid = db.session.query(db.func.sum(Expense.amount)).filter(
        Expense.payment_status == 'Paid',
        *([Expense.created_by_id.in_(company_user_ids)] if company_user_ids is not None else [])
    ).scalar() or 0
    pending_expenses = expense_q.filter_by(is_rejected=False).filter(Expense.payment_status != 'Paid').count()

    # Employee performance
    workers = user_q().filter(
        User.role.in_(['employee', 'supervisor'])
    ).all()
    performance_data = []
    for emp in workers:
        todo_c = Task.query.filter_by(assigned_to=emp.id, status='To Do', is_deleted=False).count()
        inp_c = Task.query.filter_by(assigned_to=emp.id, status='In Progress', is_deleted=False).count()
        comp_c = Task.query.filter_by(assigned_to=emp.id, status='Completed', is_deleted=False).count()
        total_emp = todo_c + inp_c + comp_c
        if total_emp > 0:
            performance_data.append({
                'user_id': emp.id,
                'username': emp.username,
                'role': emp.role,
                'todo': todo_c,
                'in_progress': inp_c,
                'completed': comp_c,
                'total': total_emp,
                'rate': round(comp_c / total_emp * 100, 1)
            })
    performance_data.sort(key=lambda x: x['completed'], reverse=True)

    # Role distribution
    role_counts = {}
    for u in User.query.filter_by(is_active=True).all():
        role_counts[u.role] = role_counts.get(u.role, 0) + 1

    # Department analysis with task breakdown
    departments = Department.query.filter_by(is_deleted=False).all()
    dept_data = []
    for dept in departments:
        dept_users = User.query.filter_by(department_id=dept.id, is_active=True).all()
        dept_user_ids = [u.id for u in dept_users]
        projects_count = Project.query.filter_by(department_id=dept.id, is_deleted=False).count()
        if dept_user_ids:
            todo_c = Task.query.filter(Task.assigned_to.in_(dept_user_ids), Task.status == 'To Do', Task.is_deleted == False).count()
            inp_c = Task.query.filter(Task.assigned_to.in_(dept_user_ids), Task.status == 'In Progress', Task.is_deleted == False).count()
            comp_c = Task.query.filter(Task.assigned_to.in_(dept_user_ids), Task.status == 'Completed', Task.is_deleted == False).count()
        else:
            todo_c = inp_c = comp_c = 0
        dept_data.append({
            'name': dept.name,
            'employees': len(dept_user_ids),
            'projects': projects_count,
            'todo': todo_c,
            'in_progress': inp_c,
            'completed': comp_c,
        })

    # Recent activity (last 10 assigned tasks)
    recent_tasks = (
        Task.query
        .filter(Task.is_deleted == False, Task.assigned_to != None)
        .order_by(Task.created_on.desc())
        .limit(10)
        .all()
    )
    activity = []
    for t in recent_tasks:
        activity.append({
            'id': t.id,
            'title': t.title,
            'status': t.status,
            'username': t.assignee.username if t.assignee else 'Unassigned',
        })

    # 7-day task trend
    today = datetime.utcnow().date()
    trend = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime(day.year, day.month, day.day, 0, 0, 0)
        day_end = datetime(day.year, day.month, day.day, 23, 59, 59)
        created_count = Task.query.filter(
            Task.created_on >= day_start,
            Task.created_on <= day_end,
            Task.is_deleted == False
        ).count()
        completed_count = Task.query.filter(
            Task.status == 'Completed',
            Task.created_on >= day_start,
            Task.created_on <= day_end,
            Task.is_deleted == False
        ).count()
        trend.append({
            'day': day.strftime('%a'),
            'date': day.strftime('%d %b'),
            'created': created_count,
            'completed': completed_count,
        })

    # Expense category breakdown
    expense_by_category = {}
    for e in Expense.query.all():
        cat = e.category or 'Other'
        expense_by_category[cat] = expense_by_category.get(cat, 0) + e.amount
    expense_categories = [{'category': k, 'amount': round(v, 2)} for k, v in expense_by_category.items()]
    expense_categories.sort(key=lambda x: x['amount'], reverse=True)

    return jsonify({
        'total_users': total_users,
        'total_departments': total_departments,
        'total_projects': total_projects,
        'task_todo': task_todo,
        'task_inprogress': task_inprogress,
        'task_completed': task_completed,
        'total_tasks': total_tasks,
        'total_expense_paid': round(float(total_expense_paid), 2),
        'pending_expenses': pending_expenses,
        'performance': performance_data[:10],
        'roles': [{'role': k, 'count': v} for k, v in role_counts.items()],
        'departments': dept_data,
        'activity': activity,
        'trend': trend,
        'expense_categories': expense_categories,
    }), 200


@bp.route('/stats/team', methods=['GET'])
def get_team_stats():
    dept_id = request.args.get('dept_id', type=int)
    if not dept_id:
        return jsonify({'message': 'dept_id required'}), 400

    dept_users = User.query.filter_by(department_id=dept_id, is_active=True).all()
    performance_data = []
    for emp in dept_users:
        todo_c = Task.query.filter_by(assigned_to=emp.id, status='To Do', is_deleted=False).count()
        inp_c  = Task.query.filter_by(assigned_to=emp.id, status='In Progress', is_deleted=False).count()
        comp_c = Task.query.filter_by(assigned_to=emp.id, status='Completed', is_deleted=False).count()
        total  = todo_c + inp_c + comp_c
        overdue = Task.query.filter(
            Task.assigned_to == emp.id,
            Task.is_deleted == False,  # noqa: E712
            Task.status != 'Completed',
            Task.deadline < datetime.utcnow()
        ).count()
        performance_data.append({
            'user_id': emp.id,
            'username': emp.username,
            'role': emp.role,
            'todo': todo_c,
            'in_progress': inp_c,
            'completed': comp_c,
            'overdue': overdue,
            'total': total,
            'rate': round(comp_c / total * 100, 1) if total > 0 else 0,
        })
    performance_data.sort(key=lambda x: x['rate'], reverse=True)
    return jsonify({'dept_id': dept_id, 'performance': performance_data}), 200
