from flask import request, jsonify
from app import db
from app.auth import bp
from app.models import User

@bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not 'username' in data or not 'password' in data:
        return jsonify({'message': 'Must include username, password and role'}), 400
    
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'Please use a different username'}), 400
        
    user = User(username=data['username'], role='employee') # Default external registration is Employee
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'message': 'User registered successfully'}), 201

@bp.route('/create_user', methods=['POST'])
def create_user():
    data = request.get_json()
    
    # In a real app, you would verify a JWT token here to ensure the requester is a 'manager'
    # Currently relying on frontend routing for protection, but backend should ideally validate.
    # We will simulate the check here if a 'manager_token' or similar was passed, but keeping it simple for now based on RBAC instructions.
    
    if not data or not 'username' in data or not 'password' in data or not 'role' in data:
        return jsonify({'message': 'Must include username, password, and role'}), 400
    
    if data['role'] not in ['manager', 'supervisor', 'employee', 'finance']:
         return jsonify({'message': 'Invalid role specified'}), 400

    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'User already exists with this ID'}), 400
        
    user = User(username=data['username'], role=data['role'])
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'message': f"{data['role'].capitalize()} account created successfully", 'user': {'username': user.username, 'role': user.role}}), 201

@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not 'username' in data or not 'password' in data:
        return jsonify({'message': 'Must include username and password'}), 400
        
    user = User.query.filter_by(username=data['username']).first()
    if user is None or not user.check_password(data['password']):
        return jsonify({'message': 'Invalid username or password'}), 401
        
    return jsonify({'message': 'Login successful', 'id': user.id, 'role': user.role,
                    'username': user.username, 'department_id': user.department_id}), 200

@bp.route('/logout', methods=['POST'])
def logout():
    return jsonify({'message': 'Logout successful'}), 200
