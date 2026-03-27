import re
from datetime import datetime, timedelta
from flask import request, jsonify
from app import db
from app.api import bp
from app.models import User, Conversation, GroupChat, Message, TypingIndicator, Notification


def _notify(user_id, ntype, title, body, ref_id=None, ref_type=None):
    """Create a notification; skip if an unread one for same ref already exists."""
    existing = Notification.query.filter_by(
        user_id=user_id, ref_id=ref_id, ref_type=ref_type, is_read=False
    ).first()
    if existing:
        # Update body to latest message but don't spam
        existing.title = title
        existing.body = body
        existing.created_at = datetime.utcnow()
        return
    n = Notification(user_id=user_id, type=ntype, title=title, body=body,
                     ref_id=ref_id, ref_type=ref_type)
    db.session.add(n)


def _is_online(user):
    if not user.last_active:
        return False
    return (datetime.utcnow() - user.last_active).total_seconds() < 120


def _msg_to_dict(msg):
    return {
        'id': msg.id,
        'content': msg.content,
        'image_attachment': msg.image_attachment,
        'message_type': msg.message_type,
        'sender': {'id': msg.sender_id, 'username': msg.sender.username},
        'created_at': msg.created_at.isoformat(),
        'is_read': msg.is_read,
    }


# ── Heartbeat ─────────────────────────────────────────────────────────────────
@bp.route('/ping', methods=['POST'])
def ping():
    data = request.get_json() or {}
    user_id = data.get('user_id')
    if user_id:
        user = User.query.get(user_id)
        if user:
            user.last_active = datetime.utcnow()
            db.session.commit()
    return jsonify({'ok': True}), 200


# ── Online status ─────────────────────────────────────────────────────────────
@bp.route('/users/online', methods=['GET'])
def users_online():
    ids_param = request.args.get('user_ids', '')
    try:
        user_ids = [int(x) for x in ids_param.split(',') if x.strip()]
    except ValueError:
        return jsonify({'message': 'Invalid user_ids'}), 400
    users = User.query.filter(User.id.in_(user_ids)).all()
    result = {str(u.id): _is_online(u) for u in users}
    return jsonify(result), 200


# ── Conversations (DM) ────────────────────────────────────────────────────────
@bp.route('/conversations', methods=['GET'])
def list_conversations():
    user_id = request.args.get('user_id', type=int)
    if not user_id:
        return jsonify({'message': 'user_id required'}), 400

    convs = Conversation.query.filter(
        (Conversation.user1_id == user_id) | (Conversation.user2_id == user_id)
    ).all()

    result = []
    for conv in convs:
        other = conv.user2 if conv.user1_id == user_id else conv.user1
        last_msg = conv.messages.order_by(Message.created_at.desc()).first()
        unread = conv.messages.filter(
            Message.sender_id != user_id,
            Message.is_read == False  # noqa: E712
        ).count()
        result.append({
            'id': conv.id,
            'type': 'dm',
            'other_user': {
                'id': other.id,
                'username': other.username,
                'online': _is_online(other),
            },
            'last_message': _msg_to_dict(last_msg) if last_msg else None,
            'unread_count': unread,
        })

    result.sort(key=lambda x: x['last_message']['created_at'] if x['last_message'] else '', reverse=True)
    return jsonify(result), 200


@bp.route('/conversations', methods=['POST'])
def get_or_create_conversation():
    data = request.get_json() or {}
    user_id = data.get('user_id')
    other_id = data.get('other_user_id')
    if not user_id or not other_id:
        return jsonify({'message': 'user_id and other_user_id required'}), 400

    u1, u2 = min(user_id, other_id), max(user_id, other_id)
    conv = Conversation.query.filter_by(user1_id=u1, user2_id=u2).first()
    if not conv:
        conv = Conversation(user1_id=u1, user2_id=u2)
        db.session.add(conv)
        db.session.commit()
    return jsonify({'conversation_id': conv.id}), 200


@bp.route('/conversations/<int:conv_id>/messages', methods=['GET'])
def get_dm_messages(conv_id):
    user_id  = request.args.get('user_id', type=int)
    since_id = request.args.get('since_id', 0, type=int)
    before_id = request.args.get('before_id', type=int)
    limit    = min(request.args.get('limit', 50, type=int), 100)

    conv = Conversation.query.get_or_404(conv_id)

    if user_id:
        conv.messages.filter(
            Message.sender_id != user_id,
            Message.is_read == False  # noqa: E712
        ).update({'is_read': True})
        db.session.commit()

    if before_id:
        # Scroll-up pagination: older messages before a known id
        msgs = conv.messages.filter(Message.id < before_id)\
                             .order_by(Message.id.desc()).limit(limit).all()
        msgs.reverse()
    elif since_id > 0:
        # Polling: only new messages since last known id (no limit — usually 0-2 rows)
        msgs = conv.messages.filter(Message.id > since_id)\
                             .order_by(Message.id.asc()).all()
    else:
        # Initial load: last `limit` messages only
        msgs = conv.messages.order_by(Message.id.desc()).limit(limit).all()
        msgs.reverse()

    return jsonify([_msg_to_dict(m) for m in msgs]), 200


@bp.route('/conversations/<int:conv_id>/messages', methods=['POST'])
def send_dm_message(conv_id):
    data = request.get_json() or {}
    conv = Conversation.query.get_or_404(conv_id)
    sender_id = data['sender_id']
    msg = Message(
        content=data.get('content'),
        image_attachment=data.get('image_attachment'),
        message_type=data.get('message_type', 'text'),
        sender_id=sender_id,
        conversation_id=conv.id,
    )
    db.session.add(msg)
    db.session.commit()

    # Notify the recipient
    recipient_id = conv.user2_id if conv.user1_id == sender_id else conv.user1_id
    sender = User.query.get(sender_id)
    snippet = msg.content[:80] if msg.content else '[image]'
    _notify(recipient_id, 'new_message',
            f'New message from {sender.username if sender else "someone"}',
            snippet, ref_id=conv_id, ref_type='conversation')
    db.session.commit()

    return jsonify(_msg_to_dict(msg)), 201


@bp.route('/conversations/<int:conv_id>/typing', methods=['POST'])
def set_dm_typing(conv_id):
    data = request.get_json() or {}
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'message': 'user_id required'}), 400
    indicator = TypingIndicator.query.filter_by(
        user_id=user_id, conversation_id=conv_id, group_id=None
    ).first()
    if indicator:
        indicator.updated_at = datetime.utcnow()
    else:
        indicator = TypingIndicator(user_id=user_id, conversation_id=conv_id)
        db.session.add(indicator)
    db.session.commit()
    return jsonify({'ok': True}), 200


@bp.route('/conversations/<int:conv_id>/typing', methods=['GET'])
def get_dm_typing(conv_id):
    user_id = request.args.get('user_id', type=int)
    cutoff = datetime.utcnow() - timedelta(seconds=5)
    typing = TypingIndicator.query.filter(
        TypingIndicator.conversation_id == conv_id,
        TypingIndicator.user_id != user_id,
        TypingIndicator.updated_at >= cutoff
    ).first()
    typer_name = typing.user.username if typing else None
    return jsonify({'typing': typing is not None, 'username': typer_name}), 200


# ── Group chats ───────────────────────────────────────────────────────────────
@bp.route('/groups', methods=['GET'])
def list_groups():
    user_id = request.args.get('user_id', type=int)
    if not user_id:
        return jsonify({'message': 'user_id required'}), 400

    user = User.query.get_or_404(user_id)
    result = []
    for grp in user.group_chats:
        last_msg = grp.messages.order_by(Message.created_at.desc()).first()
        unread = grp.messages.filter(
            Message.sender_id != user_id,
            Message.is_read == False  # noqa: E712
        ).count()
        result.append({
            'id': grp.id,
            'type': 'group',
            'name': grp.name,
            'member_count': len(grp.members),
            'last_message': _msg_to_dict(last_msg) if last_msg else None,
            'unread_count': unread,
        })
    result.sort(key=lambda x: x['last_message']['created_at'] if x['last_message'] else '', reverse=True)
    return jsonify(result), 200


@bp.route('/groups', methods=['POST'])
def create_group():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    created_by = data.get('created_by')
    member_ids = data.get('member_ids', [])
    if not name or not created_by:
        return jsonify({'message': 'name and created_by required'}), 400

    grp = GroupChat(name=name, created_by=created_by)
    all_ids = list(set([created_by] + member_ids))
    grp.members = User.query.filter(User.id.in_(all_ids)).all()
    db.session.add(grp)
    db.session.commit()
    return jsonify({'group_id': grp.id, 'name': grp.name}), 201


@bp.route('/groups/<int:group_id>/info', methods=['GET'])
def get_group_info(group_id):
    grp = GroupChat.query.get_or_404(group_id)
    return jsonify({
        'id': grp.id,
        'name': grp.name,
        'created_at': grp.created_at.isoformat(),
        'creator': {
            'id': grp.creator.id,
            'username': grp.creator.username,
            'role': grp.creator.role,
        },
        'members': [
            {'id': m.id, 'username': m.username, 'role': m.role, 'online': _is_online(m)}
            for m in grp.members
        ],
    }), 200


@bp.route('/groups/<int:group_id>/members', methods=['POST'])
def add_group_member(group_id):
    data = request.get_json() or {}
    requester_id = data.get('user_id')
    member_user_id = data.get('member_user_id')

    if not requester_id or not member_user_id:
        return jsonify({'message': 'user_id and member_user_id required'}), 400

    requester = User.query.get(requester_id)
    if not requester or requester.role != 'manager':
        return jsonify({'message': 'Only managers can add group members'}), 403

    grp = GroupChat.query.get_or_404(group_id)
    member = User.query.get(member_user_id)
    if not member:
        return jsonify({'message': 'Member user not found'}), 404

    if member in grp.members:
        return jsonify({'message': 'User is already in this group'}), 200

    grp.members.append(member)
    db.session.commit()
    return jsonify({'message': 'Member added successfully'}), 200


@bp.route('/groups/<int:group_id>/members/<int:member_user_id>', methods=['DELETE'])
def remove_group_member(group_id, member_user_id):
    data = request.get_json(silent=True) or {}
    requester_id = request.args.get('user_id', type=int) or data.get('user_id')

    if not requester_id:
        return jsonify({'message': 'user_id required'}), 400

    requester = User.query.get(requester_id)
    if not requester or requester.role != 'manager':
        return jsonify({'message': 'Only managers can remove group members'}), 403

    grp = GroupChat.query.get_or_404(group_id)
    member = User.query.get(member_user_id)
    if not member:
        return jsonify({'message': 'Member user not found'}), 404

    if member not in grp.members:
        return jsonify({'message': 'User is not in this group'}), 404

    if len(grp.members) <= 1:
        return jsonify({'message': 'Group must have at least one member'}), 400

    grp.members.remove(member)
    db.session.commit()
    return jsonify({'message': 'Member removed successfully'}), 200


@bp.route('/groups/<int:group_id>/messages', methods=['GET'])
def get_group_messages(group_id):
    user_id   = request.args.get('user_id', type=int)
    since_id  = request.args.get('since_id', 0, type=int)
    before_id = request.args.get('before_id', type=int)
    limit     = min(request.args.get('limit', 50, type=int), 100)

    grp = GroupChat.query.get_or_404(group_id)

    if user_id:
        grp.messages.filter(
            Message.sender_id != user_id,
            Message.is_read == False  # noqa: E712
        ).update({'is_read': True})
        db.session.commit()

    if before_id:
        msgs = grp.messages.filter(Message.id < before_id)\
                            .order_by(Message.id.desc()).limit(limit).all()
        msgs.reverse()
    elif since_id > 0:
        msgs = grp.messages.filter(Message.id > since_id)\
                            .order_by(Message.id.asc()).all()
    else:
        msgs = grp.messages.order_by(Message.id.desc()).limit(limit).all()
        msgs.reverse()

    return jsonify([_msg_to_dict(m) for m in msgs]), 200


@bp.route('/groups/<int:group_id>/messages', methods=['POST'])
def send_group_message(group_id):
    data = request.get_json() or {}
    grp = GroupChat.query.get_or_404(group_id)
    sender_id = data['sender_id']
    msg = Message(
        content=data.get('content'),
        image_attachment=data.get('image_attachment'),
        message_type=data.get('message_type', 'text'),
        sender_id=sender_id,
        group_id=grp.id,
    )
    db.session.add(msg)
    db.session.commit()

    # Notify all group members except sender
    sender = User.query.get(sender_id)
    snippet = msg.content[:80] if msg.content else '[image]'
    for member in grp.members:
        if member.id != sender_id:
            _notify(member.id, 'new_message',
                    f'{sender.username if sender else "Someone"} in {grp.name}',
                    snippet, ref_id=group_id, ref_type='group')

    # Fire mention notifications for @username patterns
    if msg.content:
        mentioned_usernames = re.findall(r'@(\w+)', msg.content)
        if mentioned_usernames:
            member_map = {m.username.lower(): m for m in grp.members}
            for uname in set(mentioned_usernames):
                mentioned = member_map.get(uname.lower())
                if mentioned and mentioned.id != sender_id:
                    _notify(mentioned.id, 'mention',
                            f'@{sender.username if sender else "Someone"} mentioned you in {grp.name}',
                            msg.content[:80], ref_id=group_id, ref_type='group')

    db.session.commit()

    return jsonify(_msg_to_dict(msg)), 201


@bp.route('/groups/<int:group_id>/typing', methods=['POST'])
def set_group_typing(group_id):
    data = request.get_json() or {}
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'message': 'user_id required'}), 400
    indicator = TypingIndicator.query.filter_by(
        user_id=user_id, group_id=group_id, conversation_id=None
    ).first()
    if indicator:
        indicator.updated_at = datetime.utcnow()
    else:
        indicator = TypingIndicator(user_id=user_id, group_id=group_id)
        db.session.add(indicator)
    db.session.commit()
    return jsonify({'ok': True}), 200


@bp.route('/groups/<int:group_id>/typing', methods=['GET'])
def get_group_typing(group_id):
    user_id = request.args.get('user_id', type=int)
    cutoff = datetime.utcnow() - timedelta(seconds=5)
    typing = TypingIndicator.query.filter(
        TypingIndicator.group_id == group_id,
        TypingIndicator.user_id != user_id,
        TypingIndicator.updated_at >= cutoff
    ).first()
    typer_name = typing.user.username if typing else None
    return jsonify({'typing': typing is not None, 'username': typer_name}), 200
