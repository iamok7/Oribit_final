from datetime import datetime
from flask import request, jsonify
from app import db
from app.api import bp
from app.models import User, Requirement, RequirementComment, Notification


def _notify(user_id, ntype, title, body, ref_id=None, ref_type=None):
    n = Notification(user_id=user_id, type=ntype, title=title, body=body,
                     ref_id=ref_id, ref_type=ref_type)
    db.session.add(n)

VALID_CATEGORIES = {'manpower', 'machinery', 'uniforms', 'shoes', 'other'}
VALID_STATUSES   = {'open', 'in_review', 'resolved'}


@bp.route('/requirements', methods=['POST'])
def create_requirement():
    data = request.get_json() or {}
    title    = (data.get('title') or '').strip()
    category = (data.get('category') or '').strip().lower()
    poster_id = data.get('posted_by_id')

    if not title or not category or not poster_id:
        return jsonify({'message': 'title, category, and posted_by_id are required'}), 400
    if category not in VALID_CATEGORIES:
        return jsonify({'message': f'category must be one of {sorted(VALID_CATEGORIES)}'}), 400

    poster = User.query.get(poster_id)
    if not poster:
        return jsonify({'message': 'User not found'}), 404

    deadline_str = data.get('deadline')
    deadline_dt = None
    if deadline_str:
        try:
            deadline_dt = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
        except ValueError:
            pass

    req = Requirement(
        title=title,
        description=data.get('description'),
        category=category,
        quantity=data.get('quantity'),
        deadline=deadline_dt,
        attachment=data.get('attachment'),
        posted_by_id=poster_id,
        dept_id=poster.department_id,
    )
    db.session.add(req)
    db.session.commit()
    return jsonify({'requirement_id': req.id, 'message': 'Requirement posted'}), 201


@bp.route('/requirements', methods=['GET'])
def list_requirements():
    user_id  = request.args.get('user_id', type=int)
    role     = request.args.get('role', '')
    category = request.args.get('category', '')
    status   = request.args.get('status', '')
    dept_id  = request.args.get('dept_id', type=int)

    query = Requirement.query

    if role == 'manager':
        if dept_id:
            query = query.filter_by(dept_id=dept_id)
    elif role == 'supervisor':
        user = User.query.get(user_id)
        effective_dept = dept_id or (user.department_id if user else None)
        if effective_dept:
            query = query.filter_by(dept_id=effective_dept)
    else:
        # employee — only own requirements
        if user_id:
            query = query.filter_by(posted_by_id=user_id)

    if category and category in VALID_CATEGORIES:
        query = query.filter_by(category=category)
    if status and status in VALID_STATUSES:
        query = query.filter_by(status=status)

    reqs = query.order_by(Requirement.created_at.desc()).all()

    def _req_dict(r):
        return {
            'id': r.id,
            'title': r.title,
            'description': r.description,
            'category': r.category,
            'status': r.status,
            'quantity': r.quantity,
            'deadline': r.deadline.isoformat() if r.deadline else None,
            'attachment': r.attachment,
            'poster': {'id': r.posted_by_id, 'username': r.poster.username, 'role': r.poster.role},
            'dept': {'id': r.dept_id, 'name': r.dept.name} if r.dept else None,
            'created_at': r.created_at.isoformat(),
        }

    return jsonify([_req_dict(r) for r in reqs]), 200


@bp.route('/requirements/<int:req_id>', methods=['GET'])
def get_requirement(req_id):
    r = Requirement.query.get_or_404(req_id)
    return jsonify({
        'id': r.id,
        'title': r.title,
        'description': r.description,
        'category': r.category,
        'status': r.status,
        'quantity': r.quantity,
        'deadline': r.deadline.isoformat() if r.deadline else None,
        'attachment': r.attachment,
        'poster': {'id': r.posted_by_id, 'username': r.poster.username, 'role': r.poster.role},
        'dept': {'id': r.dept_id, 'name': r.dept.name} if r.dept else None,
        'created_at': r.created_at.isoformat(),
    }), 200


@bp.route('/requirements/<int:req_id>/comments', methods=['GET'])
def list_requirement_comments(req_id):
    Requirement.query.get_or_404(req_id)
    comments = RequirementComment.query.filter_by(requirement_id=req_id)\
        .order_by(RequirementComment.created_at.asc()).all()
    def _c(c):
        return {
            'id': c.id,
            'content': c.content,
            'author': {'id': c.author_id, 'username': c.author.username, 'role': c.author.role},
            'created_at': c.created_at.isoformat(),
        }
    return jsonify([_c(c) for c in comments]), 200


@bp.route('/requirements/<int:req_id>/comments', methods=['POST'])
def post_requirement_comment(req_id):
    req  = Requirement.query.get_or_404(req_id)
    data      = request.get_json() or {}
    author_id = data.get('author_id')
    content   = (data.get('content') or '').strip()
    if not author_id or not content:
        return jsonify({'message': 'author_id and content required'}), 400
    author = User.query.get(author_id)
    if not author:
        return jsonify({'message': 'User not found'}), 404
    comment = RequirementComment(requirement_id=req_id, author_id=author_id, content=content)
    db.session.add(comment)
    db.session.commit()

    # Notify the requirement poster (if different from commenter)
    if req.posted_by_id and req.posted_by_id != author_id:
        _notify(req.posted_by_id, 'req_comment',
                f'New comment on your requirement',
                f'{author.username}: {content[:80]}',
                ref_id=req_id, ref_type='requirement')
        db.session.commit()

    return jsonify({
        'id': comment.id,
        'content': comment.content,
        'author': {'id': author.id, 'username': author.username, 'role': author.role},
        'created_at': comment.created_at.isoformat(),
    }), 201


@bp.route('/requirements/<int:req_id>/status', methods=['PUT'])
def update_requirement_status(req_id):
    data   = request.get_json() or {}
    status = (data.get('status') or '').strip().lower()
    if status not in VALID_STATUSES:
        return jsonify({'message': f'status must be one of {sorted(VALID_STATUSES)}'}), 400

    req = Requirement.query.get_or_404(req_id)
    req.status = status
    db.session.commit()
    return jsonify({'message': 'Status updated', 'status': req.status}), 200
