from flask import request, jsonify
from app import db
from app.auth import bp
from app.models import User, Company, generate_company_code


@bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    if not data:
        return jsonify({'message': 'No data provided'}), 400

    required = ['first_name', 'last_name', 'email', 'password', 'user_type']
    for field in required:
        if not data.get(field, '').strip():
            return jsonify({'message': f'{field} is required'}), 400

    user_type = data['user_type']
    if user_type not in ['individual', 'company_member']:
        return jsonify({'message': 'user_type must be individual or company_member'}), 400

    email = data['email'].strip().lower()
    if User.query.filter_by(email=email).first():
        return jsonify({'message': 'An account with this email already exists'}), 400

    # Build username from email (unique fallback)
    base_username = email.split('@')[0]
    username = base_username
    suffix = 1
    while User.query.filter_by(username=username).first():
        username = f'{base_username}{suffix}'
        suffix += 1

    company_id = None
    company_name = None

    if user_type == 'company_member':
        company_code = data.get('company_code', '').strip().upper()
        if not company_code:
            return jsonify({'message': 'company_code is required for company signup'}), 400
        company = Company.query.filter_by(company_code=company_code).first()
        if not company:
            return jsonify({'message': 'Invalid company code. Please check and try again.'}), 404
        company_id = company.id
        company_name = company.name

    user = User(
        username=username,
        email=email,
        first_name=data['first_name'].strip(),
        last_name=data['last_name'].strip(),
        role='employee',
        user_type=user_type,
        company_id=company_id,
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()

    return jsonify({
        'message': 'Account created successfully',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role,
            'user_type': user.user_type,
            'company_id': user.company_id,
            'company_name': company_name,
            'department_id': user.department_id,
        }
    }), 201


@bp.route('/validate_company_code', methods=['GET'])
def validate_company_code():
    code = request.args.get('code', '').strip().upper()
    if not code:
        return jsonify({'valid': False, 'message': 'No code provided'}), 400
    company = Company.query.filter_by(company_code=code).first()
    if company:
        return jsonify({'valid': True, 'company_name': company.name}), 200
    return jsonify({'valid': False, 'message': 'Invalid company code'}), 404


@bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not 'username' in data or not 'password' in data:
        return jsonify({'message': 'Must include username, password and role'}), 400

    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'Please use a different username'}), 400

    user = User(username=data['username'], role='employee', user_type='company_member')
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()

    return jsonify({'message': 'User registered successfully'}), 201


@bp.route('/create_user', methods=['POST'])
def create_user():
    data = request.get_json()

    if not data or not 'username' in data or not 'password' in data or not 'role' in data:
        return jsonify({'message': 'Must include username, password, and role'}), 400

    if data['role'] not in ['manager', 'supervisor', 'employee', 'finance']:
        return jsonify({'message': 'Invalid role specified'}), 400

    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'User already exists with this ID'}), 400

    # Allow passing company_id when creating company users
    company_id = data.get('company_id')

    user = User(
        username=data['username'],
        role=data['role'],
        user_type='company_member',
        company_id=company_id,
        first_name=data.get('first_name'),
        last_name=data.get('last_name'),
        email=data.get('email'),
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()

    return jsonify({
        'message': f"{data['role'].capitalize()} account created successfully",
        'user': {'id': user.id, 'username': user.username, 'role': user.role, 'company_id': user.company_id}
    }), 201


@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not 'username' in data or not 'password' in data:
        return jsonify({'message': 'Must include username and password'}), 400

    # Allow login by email or username
    identifier = data['username'].strip()
    user = User.query.filter_by(username=identifier).first()
    if not user:
        user = User.query.filter_by(email=identifier.lower()).first()

    if user is None or not user.check_password(data['password']):
        return jsonify({'message': 'Invalid username or password'}), 401

    if not user.is_active:
        return jsonify({'message': 'Account is deactivated. Contact your manager.'}), 403

    company_name = None
    if user.company_id:
        company = Company.query.get(user.company_id)
        company_name = company.name if company else None

    return jsonify({
        'message': 'Login successful',
        'id': user.id,
        'role': user.role,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'user_type': user.user_type or 'company_member',
        'company_id': user.company_id,
        'company_name': company_name,
        'department_id': user.department_id,
    }), 200


@bp.route('/logout', methods=['POST'])
def logout():
    return jsonify({'message': 'Logout successful'}), 200


@bp.route('/companies', methods=['POST'])
def create_company():
    """Create a new company (for admin setup or manager registration)."""
    data = request.get_json()
    if not data or not data.get('name', '').strip():
        return jsonify({'message': 'Company name is required'}), 400

    name = data['name'].strip()
    # Generate unique code
    code = data.get('company_code', '').strip().upper() or generate_company_code()
    while Company.query.filter_by(company_code=code).first():
        code = generate_company_code()

    company = Company(name=name, company_code=code)
    db.session.add(company)
    db.session.commit()

    return jsonify({
        'message': 'Company created successfully',
        'company': {'id': company.id, 'name': company.name, 'company_code': company.company_code}
    }), 201


@bp.route('/companies', methods=['GET'])
def list_companies():
    companies = Company.query.all()
    return jsonify([{'id': c.id, 'name': c.name, 'company_code': c.company_code} for c in companies]), 200


@bp.route('/delete_account', methods=['DELETE'])
def delete_account():
    data = request.get_json()
    if not data:
        return jsonify({'message': 'No data provided'}), 400

    user_id = data.get('user_id')
    confirmation = data.get('confirmation', '').strip().lower()

    if not user_id:
        return jsonify({'message': 'user_id is required'}), 400

    if confirmation != 'delete':
        return jsonify({'message': 'Confirmation text must be exactly "delete"'}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404

    from app.models import (Task, Comment, Notification, TypingIndicator,
                            Message, Conversation, GroupChat, Requirement,
                            RequirementComment, Expense, Issue, Subtask,
                            project_members, group_chat_members)

    try:
        # Remove project memberships
        db.session.execute(project_members.delete().where(
            project_members.c.user_id == user_id))

        # Remove group chat memberships
        db.session.execute(group_chat_members.delete().where(
            group_chat_members.c.user_id == user_id))

        # Delete typing indicators
        TypingIndicator.query.filter_by(user_id=user_id).delete()

        # Delete notifications for this user
        Notification.query.filter_by(user_id=user_id).delete()

        # Delete messages sent by user
        Message.query.filter_by(sender_id=user_id).delete()

        # Delete conversations where user is a participant
        conv_ids = [c.id for c in Conversation.query.filter(
            (Conversation.user1_id == user_id) | (Conversation.user2_id == user_id)
        ).all()]
        if conv_ids:
            Message.query.filter(Message.conversation_id.in_(conv_ids)).delete(synchronize_session=False)
            Conversation.query.filter(Conversation.id.in_(conv_ids)).delete(synchronize_session=False)

        # Delete requirement comments by user
        RequirementComment.query.filter_by(author_id=user_id).delete()

        # Delete requirements posted by user (and their comments)
        req_ids = [r.id for r in Requirement.query.filter_by(posted_by_id=user_id).all()]
        if req_ids:
            RequirementComment.query.filter(RequirementComment.requirement_id.in_(req_ids)).delete(synchronize_session=False)
            Requirement.query.filter(Requirement.id.in_(req_ids)).delete(synchronize_session=False)

        # Delete expenses created by user
        Expense.query.filter_by(created_by_id=user_id).delete()

        # Delete task comments by user
        Comment.query.filter_by(user_id=user_id).delete()

        # Delete issues created by user
        Issue.query.filter_by(created_by=user_id).delete()

        # Nullify tasks assigned to user
        Task.query.filter_by(assigned_to=user_id).update({'assigned_to': None})

        # Delete tasks created by user (cascades to subtasks, issues, comments)
        created_task_ids = [t.id for t in Task.query.filter_by(created_by=user_id).all()]
        if created_task_ids:
            for task in Task.query.filter(Task.id.in_(created_task_ids)).all():
                db.session.delete(task)

        db.session.delete(user)
        db.session.commit()
        return jsonify({'message': 'Account deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Failed to delete account: {str(e)}'}), 500
