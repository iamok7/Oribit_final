from flask import request, jsonify
from app import db
from app.api import bp
from app.models import Expense, User, Department
from datetime import datetime

@bp.route('/expenses', methods=['POST'])
def raise_expense():
    data = request.get_json()
    
    if not data or not data.get('title') or not data.get('amount') or not data.get('created_by_id'):
        return jsonify({'message': 'Missing required fields'}), 400
        
    user = User.query.get(data.get('created_by_id'))
    if not user:
        return jsonify({'message': 'User not found'}), 404
        
    expense = Expense(
        title=data.get('title'),
        description=data.get('description'),
        amount=float(data.get('amount')),
        category=data.get('category'),
        created_by_id=user.id,
        department_id=user.department_id,
        status='Pending',
        approval_level=0
    )
    
    db.session.add(expense)
    db.session.commit()
    
    return jsonify({'message': 'Expense raised successfully', 'expense_id': expense.id}), 201

@bp.route('/expenses', methods=['GET'])
def get_expenses():
    user_id = request.args.get('user_id')
    role = request.args.get('role')
    
    if not user_id or not role:
        return jsonify({'message': 'User ID and role are required'}), 400
        
    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404
        
    def _co_ids(u):
        if u.company_id is None:
            return [u.id]
        return [x.id for x in User.query.filter_by(company_id=u.company_id, is_active=True).all()]

    query = Expense.query

    if role == 'finance':
        # Finance sees all expenses for their company
        co_ids = _co_ids(user)
        query = query.filter(Expense.created_by_id.in_(co_ids))
    elif role == 'manager':
        # Manager sees all expenses for their company
        co_ids = _co_ids(user)
        query = query.filter(Expense.created_by_id.in_(co_ids))
    elif role == 'supervisor':
        # Supervisor sees their department's expenses
        if user.department_id is None:
            query = query.filter(Expense.department_id == None)
        else:
            query = query.filter(Expense.department_id == user.department_id)
    else:
        # Employee sees only their own
        query = query.filter(Expense.created_by_id == user.id)
        
    expenses = query.order_by(Expense.created_at.desc()).all()
    
    output = []
    for e in expenses:
        output.append({
            'id': e.id,
            'title': e.title,
            'description': e.description,
            'amount': e.amount,
            'category': e.category,
            'status': e.status,
            'approval_level': e.approval_level,
            'is_rejected': e.is_rejected,
            'rejection_reason': e.rejection_reason,
            'payment_status': e.payment_status,
            'created_at': e.created_at.isoformat(),
            'creator': e.creator.username,
            'department': e.dept.name if e.dept else 'N/A'
        })
        
    return jsonify(output), 200

@bp.route('/expenses/<int:id>/approve', methods=['PUT'])
def approve_expense(id):
    data = request.get_json()
    user_id = data.get('user_id')
    
    if not user_id:
        return jsonify({'message': 'User ID required'}), 400
        
    user = User.query.get(user_id)
    expense = Expense.query.get_or_404(id)
    
    if user.role == 'manager':
        expense.approval_level = 2
        expense.status = 'Approved'
    elif user.role == 'supervisor':
        # Supervisor cannot approve their own expense
        if expense.created_by_id == user.id:
            return jsonify({'message': 'Supervisors cannot approve their own expenses. Manager approval required.'}), 403
            
        # If supervisor approves, it goes to level 1
        if expense.approval_level == 0:
            expense.approval_level = 1
            # Note: status remains 'Pending' (waiting for L2 Manager)
        else:
            return jsonify({'message': 'Expense is already approved by a supervisor.'}), 400
    else:
        return jsonify({'message': 'Unauthorized'}), 403
        
    db.session.commit()
    return jsonify({'message': f'Expense approved at Level {expense.approval_level}'}), 200

@bp.route('/expenses/<int:id>/reject', methods=['PUT'])
def reject_expense(id):
    data = request.get_json()
    user_id = data.get('user_id')
    reason = data.get('reason', 'No reason provided')
    
    if not user_id:
        return jsonify({'message': 'User ID required'}), 400
        
    user = User.query.get(user_id)
    expense = Expense.query.get_or_404(id)
    
    if user.role not in ['manager', 'supervisor']:
         return jsonify({'message': 'Unauthorized'}), 403
         
    expense.status = 'Rejected'
    expense.is_rejected = True
    expense.rejection_reason = reason
    
    db.session.commit()
    return jsonify({'message': 'Expense rejected'}), 200

@bp.route('/expenses/<int:id>/finance_status', methods=['PUT'])
def update_finance_status(id):
    data = request.get_json()
    user_id = data.get('user_id')
    status = data.get('status') # 'Paid' or 'Rejected'
    reason = data.get('reason', '')
    
    if not user_id or not status:
        return jsonify({'message': 'Missing user_id or status'}), 400
        
    user = User.query.get(user_id)
    if not user or user.role != 'finance':
        return jsonify({'message': 'Unauthorized'}), 403
        
    expense = Expense.query.get_or_404(id)
    
    if expense.approval_level < 2:
        return jsonify({'message': 'Manager approval is required before payment.'}), 400
        
    expense.payment_status = status
    
    if status == 'Rejected':
        expense.status = 'Rejected'
        expense.is_rejected = True
        expense.rejection_reason = f"Finance Rejection: {reason}"
        
    db.session.commit()
    return jsonify({'message': f'Expense marked as {status}'}), 200
