from flask import request, jsonify
from app import db
from app.api import bp
from app.models import Notification


@bp.route('/notifications', methods=['GET'])
def get_notifications():
    user_id = request.args.get('user_id', type=int)
    if not user_id:
        return jsonify({'message': 'user_id required'}), 400

    notes = (
        Notification.query
        .filter_by(user_id=user_id)
        .order_by(Notification.created_at.desc())
        .limit(80)
        .all()
    )
    unread = sum(1 for n in notes if not n.is_read)
    return jsonify({
        'notifications': [_to_dict(n) for n in notes],
        'unread_count': unread,
    }), 200


@bp.route('/notifications/<int:notif_id>/read', methods=['PUT'])
def mark_notification_read(notif_id):
    n = Notification.query.get_or_404(notif_id)
    n.is_read = True
    db.session.commit()
    return jsonify({'ok': True}), 200


@bp.route('/notifications/read-all', methods=['PUT'])
def mark_all_read():
    user_id = request.get_json(silent=True, force=True) or {}
    if isinstance(user_id, dict):
        user_id = user_id.get('user_id')
    if not user_id:
        user_id = request.args.get('user_id', type=int)
    if not user_id:
        return jsonify({'message': 'user_id required'}), 400
    Notification.query.filter_by(user_id=user_id, is_read=False).update({'is_read': True})
    db.session.commit()
    return jsonify({'ok': True}), 200


def _to_dict(n):
    return {
        'id':         n.id,
        'type':       n.type,
        'title':      n.title,
        'body':       n.body,
        'is_read':    n.is_read,
        'ref_id':     n.ref_id,
        'ref_type':   n.ref_type,
        'created_at': n.created_at.isoformat(),
    }
