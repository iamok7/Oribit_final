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
