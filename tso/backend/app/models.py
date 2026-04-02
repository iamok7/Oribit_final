from datetime import datetime
from app import db
from werkzeug.security import generate_password_hash, check_password_hash
import random
import string

# Association table for the many-to-many relationship between Users and Projects
project_members = db.Table('project_members',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('project_id', db.Integer, db.ForeignKey('project.id'), primary_key=True)
)


def generate_company_code():
    """Generate a unique 8-character alphanumeric company code."""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))


class Company(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    company_code = db.Column(db.String(20), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Company {self.name} ({self.company_code})>'

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), default='To Do') # To Do, In Progress, Completed
    deadline = db.Column(db.DateTime, nullable=True)
    created_on = db.Column(db.DateTime, default=datetime.utcnow)
    start_time = db.Column(db.DateTime, nullable=True)
    is_daily_task = db.Column(db.Boolean, default=False)
    is_deleted = db.Column(db.Boolean, default=False)
    tags = db.Column(db.String(500), nullable=True)          # Comma-separated tags
    co_assignees = db.Column(db.Text, nullable=True)          # Comma-separated user IDs
    image_attachment = db.Column(db.Text, nullable=True)      # Base64 image data URL
    priority = db.Column(db.String(20), default='medium', nullable=True)  # low, medium, high

    # Foreign Keys
    assigned_to = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=True)

    # Relationships
    assignee = db.relationship('User', foreign_keys=[assigned_to], backref='assigned_tasks')
    creator = db.relationship('User', foreign_keys=[created_by], backref='created_tasks')
    
    subtasks = db.relationship('Subtask', backref='task', lazy='dynamic', cascade='all, delete-orphan')
    issues = db.relationship('Issue', backref='task', lazy='dynamic', cascade='all, delete-orphan')
    comments = db.relationship('Comment', backref='task', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Task {self.title}>'

class Subtask(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    is_completed = db.Column(db.Boolean, default=False)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Issue(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    deadline = db.Column(db.DateTime, nullable=True)
    is_resolved = db.Column(db.Boolean, default=False)
    
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    creator = db.relationship('User', foreign_keys=[created_by], backref='created_issues')

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=True)          # Optional when image_attachment present
    image_attachment = db.Column(db.Text, nullable=True)  # Base64 image data URL

    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', foreign_keys=[user_id], backref='task_comments')

class Department(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    is_deleted = db.Column(db.Boolean, default=False)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=True)
    
    # Establish relationship with User holding the 'supervisor' role and 'employee' role.
    members = db.relationship('User', backref='department', lazy='dynamic')
    
    # Relationship to projects within this department
    projects = db.relationship('Project', backref='department', lazy='dynamic')

    def __repr__(self):
        return '<Department {}>'.format(self.name)

class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=False)
    is_deleted = db.Column(db.Boolean, default=False)
    
    # Team Lead (one-to-many from User to Project)
    lead_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    lead = db.relationship('User', foreign_keys=[lead_id], backref='led_projects')

    # Team Members (many-to-many)
    members = db.relationship('User', secondary=project_members, lazy='subquery',
        backref=db.backref('projects', lazy=True))
        
    tasks = db.relationship('Task', backref='project', lazy='dynamic')

    def __repr__(self):
        return '<Project {}>'.format(self.name)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(120), nullable=True)
    first_name = db.Column(db.String(50), nullable=True)
    last_name = db.Column(db.String(50), nullable=True)
    password_hash = db.Column(db.String(256))
    role = db.Column(db.String(20), default='employee') # manager, supervisor, employee, finance
    user_type = db.Column(db.String(20), default='company_member')  # 'individual' or 'company_member'
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=True)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    last_active = db.Column(db.DateTime, nullable=True)

    company = db.relationship('Company', foreign_keys=[company_id], backref=db.backref('members', lazy='dynamic'))

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return '<User {}>'.format(self.username)

# ── Messaging association table ──────────────────────────────────────────────
group_chat_members = db.Table('group_chat_members',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('group_chat_id', db.Integer, db.ForeignKey('group_chat.id'), primary_key=True)
)

class Conversation(db.Model):
    """Direct message thread between exactly two users."""
    id = db.Column(db.Integer, primary_key=True)
    user1_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    user2_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint('user1_id', 'user2_id', name='uq_conversation_pair'),)
    user1 = db.relationship('User', foreign_keys=[user1_id])
    user2 = db.relationship('User', foreign_keys=[user2_id])

class GroupChat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    creator = db.relationship('User', foreign_keys=[created_by])
    members = db.relationship('User', secondary=group_chat_members,
                              lazy='subquery', backref=db.backref('group_chats', lazy=True))

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=True)
    image_attachment = db.Column(db.Text, nullable=True)  # Base64, mirrors Comment pattern
    message_type = db.Column(db.String(10), default='text')  # 'text' | 'image'
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversation.id'), nullable=True, index=True)
    group_id = db.Column(db.Integer, db.ForeignKey('group_chat.id'), nullable=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    is_read = db.Column(db.Boolean, default=False, index=True)
    sender = db.relationship('User', foreign_keys=[sender_id], backref='sent_messages')
    conversation = db.relationship('Conversation', foreign_keys=[conversation_id],
                                   backref=db.backref('messages', lazy='dynamic'))
    group = db.relationship('GroupChat', foreign_keys=[group_id],
                            backref=db.backref('messages', lazy='dynamic'))

class TypingIndicator(db.Model):
    """Ephemeral row upserted on keystrokes; expires after 5 seconds."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    conversation_id = db.Column(db.Integer, nullable=True)
    group_id = db.Column(db.Integer, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)
    user = db.relationship('User', foreign_keys=[user_id])

# ── Requirements ──────────────────────────────────────────────────────────────
class Requirement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    category = db.Column(db.String(50), nullable=False)  # manpower|machinery|uniforms|shoes|other
    status = db.Column(db.String(20), default='open')    # open|in_review|resolved
    quantity = db.Column(db.Integer, nullable=True)      # how many are needed
    deadline = db.Column(db.DateTime, nullable=True)     # when it must be fulfilled
    attachment = db.Column(db.Text, nullable=True)
    posted_by_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    dept_id = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    poster = db.relationship('User', foreign_keys=[posted_by_id], backref='requirements')
    dept = db.relationship('Department', foreign_keys=[dept_id], backref='requirements')

class RequirementComment(db.Model):
    __tablename__ = 'requirement_comment'
    id             = db.Column(db.Integer, primary_key=True)
    requirement_id = db.Column(db.Integer, db.ForeignKey('requirement.id'), nullable=False)
    author_id      = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content        = db.Column(db.Text, nullable=False)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)
    requirement    = db.relationship('Requirement', backref='req_comments')
    author         = db.relationship('User', foreign_keys=[author_id])

class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(50), default='Pending') # Pending, Approved, Rejected
    approval_level = db.Column(db.Integer, default=0) # 0: Pending, 1: Supervisor, 2: Manager
    is_rejected = db.Column(db.Boolean, default=False)
    rejection_reason = db.Column(db.Text, nullable=True)
    payment_status = db.Column(db.String(50), default='Unpaid') # Unpaid, Paid, Rejected
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign Keys
    created_by_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=True)
    
    # Relationships
    creator = db.relationship('User', foreign_keys=[created_by_id], backref='expenses')
    # Use backref name 'expenses' so Department.expenses is available
    dept = db.relationship('Department', foreign_keys=[department_id], backref='expenses')

    def __repr__(self):
        return f'<Expense {self.title} - {self.amount}>'

# ── Notifications ─────────────────────────────────────────────────────────────
class Notification(db.Model):
    __tablename__ = 'notification'
    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    type       = db.Column(db.String(50), nullable=False)
    # task_assigned | task_status | task_comment | new_message | req_comment
    title      = db.Column(db.String(200), nullable=False)
    body       = db.Column(db.String(500))
    is_read    = db.Column(db.Boolean, default=False)
    ref_id     = db.Column(db.Integer)    # task_id / conv_id / group_id / req_id
    ref_type   = db.Column(db.String(50)) # 'task' | 'conversation' | 'group' | 'requirement'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user       = db.relationship('User', foreign_keys=[user_id], backref='notifications')
