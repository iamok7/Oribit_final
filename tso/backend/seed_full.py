"""
Full data seed: departments, projects, tasks (past 3 months + upcoming),
daily tasks, subtasks, issues, comments, requirements, group/direct chats.
Run: source venv/bin/activate && python seed_full.py
"""

from datetime import datetime, timedelta
from app import create_app, db
from app.models import (
    User, Department, Project, Task, Subtask, Issue, Comment,
    Requirement, RequirementComment,
    Conversation, GroupChat, Message,
)

app = create_app()

TODAY = datetime(2026, 3, 28)

def d(days_offset):
    return TODAY + timedelta(days=days_offset)

def seed():
    with app.app_context():
        # ── Fetch users ───────────────────────────────────────────────────────
        rajesh   = User.query.filter_by(username='Rajesh').first()
        suresh   = User.query.filter_by(username='Suresh').first()
        priya    = User.query.filter_by(username='Priya').first()
        kavitha  = User.query.filter_by(username='Kavitha').first()
        amit     = User.query.filter_by(username='Amit').first()
        sunita   = User.query.filter_by(username='Sunita').first()
        vikram   = User.query.filter_by(username='Vikram').first()
        pooja    = User.query.filter_by(username='Pooja').first()
        arjun    = User.query.filter_by(username='Arjun').first()

        all_users = [rajesh, suresh, priya, kavitha, amit, sunita, vikram, pooja, arjun]
        if any(u is None for u in all_users):
            print("ERROR: Some users not found. Run seed.py first.")
            return

        # ── Wipe existing data (keep users) ──────────────────────────────────
        for model in [Message, Conversation, GroupChat,
                      RequirementComment, Requirement,
                      Comment, Issue, Subtask, Task,
                      Project, Department]:
            try:
                db.session.query(model).delete()
            except Exception as e:
                print(f"  skip wipe {model.__name__}: {e}")
                db.session.rollback()
        db.session.commit()
        print("Wiped existing data.")

        # ── Departments ───────────────────────────────────────────────────────
        eng  = Department(name='Engineering')
        ops  = Department(name='Operations')
        hr   = Department(name='HR & Admin')
        db.session.add_all([eng, ops, hr])
        db.session.flush()

        # Assign departments to users
        rajesh.department_id  = eng.id
        suresh.department_id  = ops.id
        priya.department_id   = eng.id
        kavitha.department_id = ops.id
        amit.department_id    = eng.id
        sunita.department_id  = eng.id
        vikram.department_id  = ops.id
        pooja.department_id   = ops.id
        arjun.department_id   = hr.id
        db.session.flush()

        # ── Projects ──────────────────────────────────────────────────────────
        p_portal   = Project(name='Client Portal v2',      department_id=eng.id,  lead_id=priya.id)
        p_mobile   = Project(name='Mobile App Revamp',     department_id=eng.id,  lead_id=priya.id)
        p_infra    = Project(name='Cloud Infrastructure',  department_id=eng.id,  lead_id=rajesh.id)
        p_ops_flow = Project(name='Ops Workflow System',   department_id=ops.id,  lead_id=kavitha.id)
        p_hr_sys   = Project(name='HR Self-Service Portal',department_id=hr.id,   lead_id=suresh.id)
        db.session.add_all([p_portal, p_mobile, p_infra, p_ops_flow, p_hr_sys])
        db.session.flush()

        # Project members
        p_portal.members   = [priya, amit, sunita, rajesh]
        p_mobile.members   = [priya, amit, sunita]
        p_infra.members    = [rajesh, vikram, arjun]
        p_ops_flow.members = [kavitha, vikram, pooja, suresh]
        p_hr_sys.members   = [suresh, arjun, pooja]
        db.session.flush()

        # ── Helper to create a task with subtasks ────────────────────────────
        def make_task(title, desc, status, created_by, assigned_to, project,
                      created_at, deadline, is_daily=False, priority='medium',
                      tags='', subtask_titles=None, co_ids=None):
            t = Task(
                title=title, description=desc, status=status,
                created_by=created_by.id, assigned_to=assigned_to.id,
                project_id=project.id if project else None,
                created_on=created_at, deadline=deadline,
                is_daily_task=is_daily, priority=priority,
                tags=tags,
                co_assignees=','.join(str(i) for i in co_ids) if co_ids else None,
            )
            db.session.add(t)
            db.session.flush()
            for st_title in (subtask_titles or []):
                st = Subtask(title=st_title, task_id=t.id,
                             is_completed=(status == 'Completed'),
                             created_at=created_at)
                db.session.add(st)
            return t

        # ══════════════════════════════════════════════════════════════════════
        # PAST 3 MONTHS — COMPLETED TASKS
        # ══════════════════════════════════════════════════════════════════════

        t1 = make_task(
            'Design new dashboard UI mockups',
            'Create Figma wireframes for the Client Portal v2 dashboard. Include widgets for tasks, notifications, KPIs, and quick actions. Ensure mobile-responsive breakpoints are considered.',
            'Completed', rajesh, amit, p_portal, d(-85), d(-75),
            priority='high', tags='design,frontend,ui',
            subtask_titles=['Sketch low-fidelity wireframes', 'Create high-fidelity Figma mockup',
                            'Review with stakeholders', 'Incorporate feedback', 'Final handoff to dev'],
        )

        t2 = make_task(
            'Set up PostgreSQL RDS instance',
            'Provision AWS RDS PostgreSQL 14 instance for production. Configure multi-AZ, automated backups (7-day retention), parameter groups, security groups. Document connection strings in Confluence.',
            'Completed', rajesh, vikram, p_infra, d(-82), d(-70),
            priority='high', tags='infrastructure,aws,database',
            subtask_titles=['Create RDS subnet group', 'Provision RDS instance', 'Configure security groups',
                            'Run migration scripts', 'Update .env configs', 'Smoke test connections'],
        )

        t3 = make_task(
            'Implement JWT authentication module',
            'Build JWT-based auth for the backend API. Include access token (15 min) and refresh token (7 days) strategy. Store refresh tokens in Redis. Add logout/revoke endpoints.',
            'Completed', priya, amit, p_portal, d(-78), d(-65),
            priority='high', tags='backend,security,auth',
            subtask_titles=['Write token generation utility', 'Build login endpoint',
                            'Build refresh endpoint', 'Add middleware guard', 'Write unit tests'],
            co_ids=[sunita.id],
        )

        t4 = make_task(
            'Employee attendance integration',
            'Integrate biometric attendance device API with the Ops Workflow System. Pull daily punch-in/out records, calculate hours worked, flag anomalies. Notify supervisors for missing punches.',
            'Completed', suresh, pooja, p_ops_flow, d(-75), d(-60),
            priority='medium', tags='integration,hr,attendance',
            subtask_titles=['Map biometric API fields', 'Write data ingestion cron',
                            'Build anomaly detection logic', 'Create supervisor alert emails', 'Test with sample data'],
        )

        t5 = make_task(
            'Refactor task assignment API',
            'Refactor the /api/tasks/assign endpoint to support bulk assignment, co-assignees, and assignment history logging. Maintain backward compatibility with v1 clients.',
            'Completed', priya, sunita, p_portal, d(-72), d(-58),
            priority='medium', tags='backend,api,refactor',
            subtask_titles=['Review existing endpoint', 'Add bulk assignment support',
                            'Add co-assignee field', 'Write assignment history model', 'Update API docs'],
        )

        t6 = make_task(
            'Set up CI/CD pipeline — GitHub Actions',
            'Configure GitHub Actions for the monorepo. Build + lint on PR, deploy backend to EC2 on merge to main, deploy frontend to S3/CloudFront. Add Slack notifications for failures.',
            'Completed', rajesh, arjun, p_infra, d(-70), d(-55),
            priority='high', tags='devops,cicd,automation',
            subtask_titles=['Write backend build workflow', 'Write frontend build workflow',
                            'Configure EC2 deploy step', 'Configure S3 deploy step', 'Add Slack webhook notification'],
        )

        t7 = make_task(
            'Create expense report module',
            'Build an expense submission and approval workflow. Employees submit receipts (image upload), supervisor approves level-1, manager approves level-2. Finance team can export CSV.',
            'Completed', suresh, pooja, p_ops_flow, d(-65), d(-50),
            priority='medium', tags='finance,workflow,module',
            subtask_titles=['Design data model', 'Build submission form', 'Build approval workflow',
                            'Add image upload for receipts', 'Add CSV export for finance'],
        )

        t8 = make_task(
            'Mobile app push notifications',
            'Integrate Firebase Cloud Messaging (FCM) for push notifications on the Mobile App. Handle task assignments, due-date reminders, and chat messages. Support iOS and Android.',
            'Completed', priya, amit, p_mobile, d(-60), d(-45),
            priority='high', tags='mobile,firebase,notifications',
            subtask_titles=['Set up FCM project', 'Register device tokens on login',
                            'Implement task-assignment trigger', 'Implement due-date reminder cron',
                            'Test on Android emulator', 'Test on iOS simulator'],
        )

        t9 = make_task(
            'HR leave management module',
            'Build leave application and approval system for the HR Self-Service Portal. Employees apply for leave, manager approves/rejects. Track leave balances by type (casual, sick, earned).',
            'Completed', suresh, arjun, p_hr_sys, d(-55), d(-40),
            priority='medium', tags='hr,leave,workflow',
            subtask_titles=['Design leave balance schema', 'Build leave application form',
                            'Build approval/rejection workflow', 'Track leave balance deductions', 'Generate leave reports'],
        )

        t10 = make_task(
            'Optimize database queries — task list endpoint',
            'Profile /api/tasks endpoint. Current p99 is 1.2s. Target <200ms. Add indexes, replace N+1 queries with joins, add Redis caching for frequently-accessed task lists.',
            'Completed', priya, sunita, p_portal, d(-50), d(-35),
            priority='high', tags='performance,database,backend',
            subtask_titles=['Profile with py-spy', 'Identify N+1 queries',
                            'Add DB indexes', 'Implement Redis cache layer', 'Load test with Locust'],
        )

        t11 = make_task(
            'Vendor onboarding documentation',
            'Prepare vendor onboarding pack: API integration guide, SLA document, NDA template, data-sharing agreement. Coordinate with legal team for final sign-off.',
            'Completed', suresh, vikram, p_ops_flow, d(-48), d(-30),
            priority='low', tags='documentation,vendor,legal',
            subtask_titles=['Draft API integration guide', 'Draft SLA document',
                            'Coordinate NDA with legal', 'Compile final pack', 'Send to 3 pilot vendors'],
        )

        t12 = make_task(
            'Real-time chat — WebSocket backbone',
            'Implement Socket.IO server-side events for direct messages and group chats. Handle reconnections, message delivery receipts, and typing indicators.',
            'Completed', rajesh, amit, p_portal, d(-45), d(-25),
            priority='high', tags='backend,realtime,websocket',
            subtask_titles=['Set up Socket.IO namespace', 'Handle join/leave room events',
                            'Implement message delivery receipt', 'Implement typing indicator',
                            'Handle disconnect/reconnect gracefully'],
            co_ids=[sunita.id],
        )

        # ══════════════════════════════════════════════════════════════════════
        # RECENT — IN PROGRESS TASKS
        # ══════════════════════════════════════════════════════════════════════

        t13 = make_task(
            'Build project analytics dashboard',
            'Create a manager-facing analytics page showing task completion rates, overdue tasks per project, individual contributor metrics, and burn-down charts. Use Chart.js on the frontend.',
            'In Progress', rajesh, sunita, p_portal, d(-20), d(10),
            priority='high', tags='frontend,analytics,dashboard',
            subtask_titles=['Design chart layouts', 'Implement task completion rate chart',
                            'Implement overdue task breakdown', 'Implement contributor heatmap',
                            'Add date-range filter', 'Write API endpoints'],
            co_ids=[amit.id],
        )

        t14 = make_task(
            'Migrate frontend state to Redux Toolkit',
            'Refactor existing Context API state management to Redux Toolkit (RTK). Prioritise auth slice, tasks slice, and notifications slice. Use RTK Query for all API calls.',
            'In Progress', priya, amit, p_portal, d(-18), d(14),
            priority='medium', tags='frontend,redux,refactor',
            subtask_titles=['Set up Redux store', 'Migrate auth context → auth slice',
                            'Migrate tasks context → tasks slice', 'Migrate notifications context',
                            'Replace useEffect API calls with RTK Query'],
        )

        t15 = make_task(
            'Field inspection mobile screen',
            'Build a new screen in the Mobile App for field employees to submit inspection reports. Include photo capture, GPS location tag, checklist form, and offline queue.',
            'In Progress', priya, vikram, p_mobile, d(-15), d(12),
            priority='high', tags='mobile,field,offline',
            subtask_titles=['Design screen UI', 'Implement checklist form component',
                            'Add camera capture', 'Add GPS location tag', 'Implement offline queue with SQLite'],
        )

        t16 = make_task(
            'Ops shift scheduling module',
            'Build a shift scheduler for Operations supervisors. Allow creation of weekly shift templates, assign employees to shifts, detect conflicts, and send shift reminders 24h before start.',
            'In Progress', suresh, kavitha, p_ops_flow, d(-12), d(18),
            priority='medium', tags='ops,scheduling,module',
            subtask_titles=['Design shift data model', 'Build weekly template creator',
                            'Build employee-shift assignment', 'Add conflict detection', 'Add reminder notifications'],
            co_ids=[pooja.id],
        )

        t17 = make_task(
            'Payroll integration with HRMS',
            'Integrate attendance data with the third-party HRMS for automated payroll calculation. Map fields, handle leave deductions, and generate a monthly payroll summary report.',
            'In Progress', suresh, arjun, p_hr_sys, d(-10), d(20),
            priority='high', tags='hr,payroll,integration',
            subtask_titles=['Map HRMS API schema', 'Write attendance-to-payroll transformer',
                            'Handle leave deduction logic', 'Generate monthly summary report',
                            'UAT with HR team'],
        )

        t18 = make_task(
            'Dark mode implementation',
            'Add dark mode support to the web app and mobile app. Use CSS custom properties (web) and React Native Appearance API (mobile). Persist user preference in profile settings.',
            'In Progress', priya, pooja, p_portal, d(-8), d(22),
            priority='low', tags='frontend,ui,accessibility',
            subtask_titles=['Define CSS dark-mode variables', 'Apply dark theme to all components',
                            'Add toggle in settings', 'Apply to mobile app screens', 'Test on all major browsers'],
        )

        # ══════════════════════════════════════════════════════════════════════
        # UPCOMING / TO DO
        # ══════════════════════════════════════════════════════════════════════

        t19 = make_task(
            'Client Portal v2 — UAT sign-off',
            'Conduct user acceptance testing for Client Portal v2 with 5 pilot clients. Document test cases, record defects in Jira, obtain sign-off before production go-live on April 25.',
            'To Do', rajesh, priya, p_portal, d(-2), d(28),
            priority='high', tags='qa,uat,release',
            subtask_titles=['Prepare UAT test case document', 'Schedule sessions with pilot clients',
                            'Conduct UAT sessions', 'Log defects', 'Obtain sign-off emails'],
        )

        t20 = make_task(
            'Production deployment — Portal v2',
            'Deploy Client Portal v2 to production. Blue-green deployment via Elastic Beanstalk. Run smoke tests. Update DNS. Monitor error rates for 48h post-deployment.',
            'To Do', rajesh, vikram, p_portal, d(1), d(30),
            priority='high', tags='devops,deployment,production',
            subtask_titles=['Tag release candidate', 'Deploy to staging for final check',
                            'Execute blue-green deploy', 'Run smoke tests', 'Update DNS records',
                            'Monitor CloudWatch for 48h'],
        )

        t21 = make_task(
            'Q2 performance review data collection',
            'Collect Q2 performance data for all 9 team members. Gather peer reviews, task completion rates, attendance records. Prepare summary sheets for manager reviews.',
            'To Do', suresh, arjun, p_hr_sys, d(2), d(35),
            priority='medium', tags='hr,performance,review',
            subtask_titles=['Pull task completion stats from DB', 'Collect attendance records',
                            'Send peer review forms', 'Compile summary sheets'],
        )

        t22 = make_task(
            'Mobile app — offline sync engine',
            'Build a robust offline-first sync engine for the mobile app. Queue mutations locally (SQLite WAL), replay on reconnect with conflict resolution (last-write-wins).',
            'To Do', priya, amit, p_mobile, d(3), d(45),
            priority='high', tags='mobile,offline,sync',
            subtask_titles=['Design sync queue schema', 'Implement mutation queue',
                            'Implement replay-on-reconnect', 'Add conflict resolution logic',
                            'Test with airplane-mode simulation'],
        )

        t23 = make_task(
            'Vendor payment reconciliation report',
            'Build automated monthly reconciliation report comparing vendor invoices against approved expense records. Flag discrepancies. Email PDF report to Finance and Ops Manager.',
            'To Do', suresh, pooja, p_ops_flow, d(5), d(40),
            priority='medium', tags='finance,reporting,automation',
            subtask_titles=['Define reconciliation logic', 'Pull invoice data from vendor API',
                            'Compare against expense records', 'Generate PDF report', 'Set up monthly email cron'],
        )

        t24 = make_task(
            'Security audit — OWASP Top 10 review',
            'Conduct an internal OWASP Top 10 security audit of the backend API and web frontend. Fix all critical and high findings before the Q2 external pen test on May 15.',
            'To Do', rajesh, sunita, p_infra, d(7), d(48),
            priority='high', tags='security,audit,owasp',
            subtask_titles=['Run OWASP ZAP automated scan', 'Manual review of auth flows',
                            'Review SQL injection vectors', 'Review XSS in frontend',
                            'Fix critical findings', 'Fix high findings', 'Document remediation'],
        )

        t25 = make_task(
            'Onboard new Operations vendor — TechServ',
            'Complete onboarding for TechServ as a new operations vendor. Share API credentials, test integration in staging, sign SLA, and schedule monthly review meeting.',
            'To Do', suresh, kavitha, p_ops_flow, d(8), d(42),
            priority='medium', tags='vendor,ops,onboarding',
            subtask_titles=['Share API credentials securely', 'Test integration in staging',
                            'Sign SLA document', 'Schedule monthly review meeting'],
        )

        # ══════════════════════════════════════════════════════════════════════
        # DAILY TASKS
        # ══════════════════════════════════════════════════════════════════════

        td1 = make_task(
            'Daily standup notes — Engineering',
            'Record standup notes for Engineering team. Note blockers, progress updates, and action items. Post summary to #engineering-standup Slack channel by 10:15 AM.',
            'In Progress', priya, priya, p_portal, d(-1), d(1),
            is_daily=True, priority='medium', tags='standup,daily,engineering',
            subtask_titles=['Collect updates from Amit', 'Collect updates from Sunita',
                            'Note blockers', 'Post summary to Slack'],
        )

        td2 = make_task(
            'Daily server health check',
            'Check EC2 instance health, RDS metrics, and API response times every morning. Log results in the ops-health spreadsheet. Raise alert if CPU > 80% or p99 latency > 500ms.',
            'In Progress', rajesh, arjun, p_infra, d(-1), d(1),
            is_daily=True, priority='high', tags='monitoring,daily,infrastructure',
            subtask_titles=['Check EC2 CPU/memory metrics', 'Check RDS IOPS and connections',
                            'Check API p99 latency', 'Log results in spreadsheet'],
        )

        td3 = make_task(
            'Review and triage new support tickets',
            'Review incoming support tickets from the client portal. Categorise by severity (P1–P4), assign to relevant team member, and acknowledge P1 tickets within 1 hour.',
            'In Progress', priya, sunita, p_portal, d(-1), d(1),
            is_daily=True, priority='high', tags='support,daily,triage',
            subtask_titles=['Review new tickets', 'Assign P1/P2 tickets immediately',
                            'Assign P3/P4 tickets', 'Send acknowledgement to P1 clients'],
        )

        td4 = make_task(
            'Ops daily shift briefing',
            'Conduct morning shift briefing for Operations team. Review previous day\'s output, assign daily targets, highlight safety notices, confirm equipment availability.',
            'To Do', suresh, kavitha, p_ops_flow, d(0), d(0),
            is_daily=True, priority='medium', tags='ops,daily,briefing',
            subtask_titles=['Review previous day report', 'Assign daily targets',
                            'Review safety notices', 'Confirm equipment status'],
        )

        td5 = make_task(
            'Backup verification — daily',
            'Verify that automated DB backups ran successfully overnight. Download and spot-check one backup file. Log status in the backup tracker. Alert on any failure.',
            'To Do', rajesh, vikram, p_infra, d(0), d(0),
            is_daily=True, priority='high', tags='backup,daily,infrastructure',
            subtask_titles=['Check RDS automated backup status', 'Download and spot-check backup file',
                            'Log in backup tracker'],
        )

        # ══════════════════════════════════════════════════════════════════════
        # ISSUES on tasks
        # ══════════════════════════════════════════════════════════════════════

        def add_issue(title, desc, task, created_by, created_at, resolved=False, deadline_offset=None):
            issue = Issue(
                title=title, description=desc, task_id=task.id,
                created_by=created_by.id, created_at=created_at,
                is_resolved=resolved,
                deadline=d(deadline_offset) if deadline_offset else None,
            )
            db.session.add(issue)
            return issue

        add_issue('RDS connection pool exhaustion under load',
                  'During load testing, the RDS connection pool reaches max_connections (100) at ~500 concurrent users. Need to evaluate PgBouncer or increase instance size.',
                  t2, vikram, d(-68), resolved=True)

        add_issue('JWT refresh token race condition',
                  'When two tabs refresh simultaneously, only one succeeds; the other gets 401. Need to implement a token refresh lock using Redis SETNX.',
                  t3, amit, d(-63), resolved=True)

        add_issue('Push notification delivery failure on iOS 17',
                  'FCM push notifications are silently dropped on iOS 17 when the app is in background-suspended state. APNs certificate may need renewal.',
                  t8, amit, d(-42), resolved=False, deadline_offset=5)

        add_issue('Chart.js render lag > 500ms with 1000+ tasks',
                  'The burn-down chart component freezes for ~600ms when rendering datasets with more than 1000 task entries. Consider switching to canvas-based rendering with virtualisation.',
                  t13, sunita, d(-10), resolved=False, deadline_offset=8)

        add_issue('Offline queue data loss on force-quit',
                  'If the user force-quits the mobile app before the SQLite write completes, queued mutations are lost. Need atomic write with WAL journalling.',
                  t15, vikram, d(-7), resolved=False, deadline_offset=10)

        add_issue('Redux migration breaks existing tests',
                  '47 of 120 Jest tests fail after the auth-context-to-Redux migration because they mock the old Context API. All test files using AuthContext mock need updating.',
                  t14, amit, d(-5), resolved=False, deadline_offset=14)

        # ══════════════════════════════════════════════════════════════════════
        # COMMENTS on tasks (with @mentions style)
        # ══════════════════════════════════════════════════════════════════════

        def add_comment(content, task, user, created_at):
            c = Comment(content=content, task_id=task.id, user_id=user.id, created_at=created_at)
            db.session.add(c)

        add_comment('@Vikram the RDS instance is up. Connection string pushed to SSM Parameter Store under /prod/db/url. Please update the backend .env and restart gunicorn.', t2, rajesh, d(-69))
        add_comment('Done, backend restarted. All migrations ran successfully. Smoke tests passing.', t2, vikram, d(-69))
        add_comment('@Rajesh also updated the staging .env. Both environments healthy.', t2, vikram, d(-68))

        add_comment('Auth module is ready for review. @Sunita can you please test the refresh-token flow from the frontend? Token should auto-refresh 2 min before expiry.', t3, amit, d(-62))
        add_comment('Tested — refresh flow works correctly. Edge case: if refresh fails the user is redirected to login. That is acceptable. Marking as verified on my end.', t3, sunita, d(-61))
        add_comment('Great work @Amit. Closing this. JWT module will be the foundation for the mobile app as well.', t3, priya, d(-60))

        add_comment('Dashboard charts are looking good. @Amit please review the burn-down chart component — it uses a mock data generator right now. We need to wire it to the real tasks endpoint.', t13, sunita, d(-9))
        add_comment('On it. Will use RTK Query to fetch /api/tasks?project_id=X&date_range=... — expect a PR today.', t13, amit, d(-9))
        add_comment('@Rajesh the analytics endpoint needs a new query param: group_by=day. Can you approve the schema change?', t13, sunita, d(-8))
        add_comment('Approved. Added group_by param to the endpoint. PR merged. @Sunita please pull latest.', t13, rajesh, d(-7))

        add_comment('Shift scheduling module: basic template creator is done. @Pooja please test the conflict detection — create two overlapping shifts for Vikram and see if you get an error.', t16, kavitha, d(-5))
        add_comment('Tested. Conflict detection works for direct overlaps but misses partial overlaps (e.g., shift A ends at 14:00, shift B starts at 13:30). Will raise an issue.', t16, pooja, d(-4))
        add_comment('@Kavitha fixing the partial overlap logic now. Should be resolved by EOD.', t16, vikram, d(-4))

        add_comment('Payroll integration mapping complete. @Arjun the HRMS sandbox credentials are in Bitwarden under "HRMS UAT". Please run the transformer against April test data.', t17, suresh, d(-7))
        add_comment('Ran the transformer. 3 employees have mismatched employee IDs between our system and HRMS. @Suresh can you get the correct IDs from the HR team?', t17, arjun, d(-6))

        add_comment('UAT test cases document is ready. Shared in Google Drive. @Priya please review the edge cases in section 4 — especially role-based access scenarios.', t19, rajesh, d(-1))
        add_comment('Reviewed. Looks comprehensive. One addition: add a test for manager trying to access employee-only screens — should get a 403. Adding it to the doc now.', t19, priya, d(-1))

        db.session.flush()

        # ══════════════════════════════════════════════════════════════════════
        # REQUIREMENTS
        # ══════════════════════════════════════════════════════════════════════

        def add_req(title, desc, category, status, posted_by, dept, created_at,
                    deadline_offset=None, quantity=None, req_comments=None):
            r = Requirement(
                title=title, description=desc, category=category, status=status,
                posted_by_id=posted_by.id, dept_id=dept.id, created_at=created_at,
                deadline=d(deadline_offset) if deadline_offset else None,
                quantity=quantity,
            )
            db.session.add(r)
            db.session.flush()
            for (author, text, at) in (req_comments or []):
                rc = RequirementComment(
                    requirement_id=r.id, author_id=author.id,
                    content=text, created_at=at,
                )
                db.session.add(rc)
            return r

        add_req('Hire 2 junior backend developers',
                'Engineering team is understaffed for the Q2 roadmap. We need 2 junior Python/Flask developers to join by April 15. JD approved by HR. Please initiate hiring pipeline.',
                'manpower', 'in_review', rajesh, eng, d(-30), deadline_offset=18, quantity=2,
                req_comments=[
                    (suresh, 'JD reviewed. Posting on Naukri and LinkedIn today.', d(-28)),
                    (rajesh, 'Also post on LinkedIn company page. Tag it as urgent.', d(-28)),
                    (arjun, '3 applications received so far. Screening calls scheduled for next week.', d(-20)),
                ])

        add_req('Procure 5 additional developer laptops',
                'Current developer machines are 4+ years old and struggling with the Docker-based dev environment. Requesting 5 new laptops: 16GB RAM, M-series or equivalent, for the engineering team.',
                'machinery', 'open', rajesh, eng, d(-45), deadline_offset=25, quantity=5,
                req_comments=[
                    (suresh, 'Approved budget for 3 units this quarter. Other 2 will be next quarter.', d(-40)),
                    (rajesh, 'Can we at least get 4? Vikram and Arjun\'s machines are critically slow.', d(-39)),
                ])

        add_req('Operations field staff uniforms — monsoon season',
                'Field operations staff need new waterproof uniforms for the upcoming monsoon season (June onwards). Sizes: S×4, M×6, L×3, XL×2. Delivery needed by May 20.',
                'uniforms', 'open', kavitha, ops, d(-15), deadline_offset=53, quantity=15,
                req_comments=[
                    (suresh, 'Approved. Kavitha please get 3 vendor quotes and submit by April 5.', d(-14)),
                    (kavitha, 'Will reach out to our existing uniform vendors today.', d(-13)),
                ])

        add_req('Safety boots for field engineers',
                'Requesting 8 pairs of ISI-certified safety boots for field engineers doing site visits. Steel-toed, size 7×2, 8×3, 9×2, 10×1. Required before April 10.',
                'shoes', 'resolved', kavitha, ops, d(-60), deadline_offset=-20, quantity=8,
                req_comments=[
                    (suresh, 'Approved. PO raised with SafetyFirst Supplies.', d(-58)),
                    (kavitha, 'Boots delivered and distributed to field team.', d(-22)),
                ])

        add_req('Cloud monitoring tooling — Datadog subscription',
                'Current CloudWatch setup is insufficient for distributed tracing. Requesting Datadog Pro plan for 10 hosts ($180/host/month). Essential for the Q2 performance audit.',
                'other', 'in_review', rajesh, eng, d(-20), deadline_offset=15,
                req_comments=[
                    (suresh, 'This is a significant recurring cost. Can we trial the free tier first?', d(-18)),
                    (rajesh, 'Datadog free tier caps at 1 host. We need at least 5 for meaningful APM. I can do a 14-day paid trial and report back.', d(-17)),
                    (suresh, 'OK, proceed with the 14-day trial. Report to me before committing to annual.', d(-16)),
                ])

        add_req('Hire 1 QA engineer for Client Portal v2',
                'We have no dedicated QA resource. All testing is done by developers. For the Portal v2 UAT and go-live, we need at least 1 manual QA engineer with API testing experience.',
                'manpower', 'open', priya, eng, d(-10), deadline_offset=20, quantity=1,
                req_comments=[
                    (rajesh, 'Agreed. Raising this to Suresh for approval.', d(-9)),
                    (suresh, 'Approved. Arjun please post the JD on all job portals by April 1.', d(-8)),
                ])

        add_req('Office printer replacement — Operations floor',
                'The operations floor printer (HP LaserJet 5 years old) has broken down for the third time this month. Requesting replacement with a networked multifunction printer.',
                'machinery', 'resolved', pooja, ops, d(-35), quantity=1,
                req_comments=[
                    (suresh, 'Approved. Pooja please get 2 quotes.', d(-33)),
                    (pooja, 'Canon imageRUNNER 2425 quote: ₹42,000. HP LaserJet Pro MFP M428 quote: ₹38,500.', d(-30)),
                    (suresh, 'Go with the HP. Raise PO.', d(-29)),
                    (pooja, 'Delivered and configured. Networked to ops team.', d(-25)),
                ])

        db.session.flush()

        # ══════════════════════════════════════════════════════════════════════
        # DIRECT CONVERSATIONS
        # ══════════════════════════════════════════════════════════════════════

        def get_or_create_conv(u1, u2):
            uid1, uid2 = sorted([u1.id, u2.id])
            c = Conversation(user1_id=uid1, user2_id=uid2,
                             created_at=d(-90))
            db.session.add(c)
            db.session.flush()
            return c

        def dm(conv, sender, text, at, is_read=True):
            m = Message(content=text, sender_id=sender.id,
                        conversation_id=conv.id, created_at=at,
                        is_read=is_read, message_type='text')
            db.session.add(m)

        conv_rp = get_or_create_conv(rajesh, priya)
        dm(conv_rp, rajesh, 'Priya, how is the Portal v2 timeline looking? We need to go live by April 25.', d(-25))
        dm(conv_rp, priya,  'Rajesh, UAT is scheduled for April 5–15. If we get sign-off by the 16th, deployment on the 25th is achievable.', d(-25))
        dm(conv_rp, rajesh, 'Good. Please make sure Amit and Sunita clear the open Redux migration issues before UAT starts.', d(-24))
        dm(conv_rp, priya,  'Already on it. I have a review meeting with them tomorrow morning.', d(-24))
        dm(conv_rp, priya,  'Also, Vikram flagged a memory leak in the task-list API under high concurrency. I may need 2 extra days to fix it before UAT.', d(-20))
        dm(conv_rp, rajesh, 'OK. Let me know by EOD Friday if we need to push the UAT start by 2 days. I will inform the pilot clients.', d(-20))

        conv_ra = get_or_create_conv(rajesh, arjun)
        dm(conv_ra, rajesh, 'Arjun, the server health check yesterday showed RDS CPU spiking to 91% at 11 AM. Did you catch that?', d(-3))
        dm(conv_ra, arjun,  'Yes, I saw it. Traced it to a full-table scan in the attendance report query. Added an index on (user_id, created_at). CPU is back to 22%.', d(-3))
        dm(conv_ra, rajesh, 'Nice catch. Add it to the performance log. And set a CloudWatch alarm at 80% so we get alerted earlier.', d(-2))
        dm(conv_ra, arjun,  'CloudWatch alarm set. Threshold: 80%, 5-minute average. Alert goes to ops@taskorbit.in.', d(-2))

        conv_sk = get_or_create_conv(suresh, kavitha)
        dm(conv_sk, suresh,  'Kavitha, TechServ integration — are we ready for staging tests next week?', d(-6))
        dm(conv_sk, kavitha, 'Almost. Their API sandbox credentials arrived today. Vikram is setting up the integration. Should be ready by Monday.', d(-6))
        dm(conv_sk, suresh,  'Good. Also reminder: SLA needs to be signed before we go live. Chase their legal team.', d(-5))
        dm(conv_sk, kavitha, 'Already sent the SLA draft to their procurement team. Waiting on their redlines.', d(-5))

        conv_av = get_or_create_conv(amit, vikram)
        dm(conv_av, amit,   'Vikram, can you review my PR for the Redux tasks slice? I refactored the thunks to use RTK Query — want a second pair of eyes before I tag Priya.', d(-8))
        dm(conv_av, vikram, 'Sure, give me 30 mins. Link to the PR?', d(-8))
        dm(conv_av, amit,   'github.com/taskorbit/tso/pull/147', d(-8))
        dm(conv_av, vikram, 'Reviewed. Left 3 comments — minor stuff. The optimistic update logic in updateTask looks solid. LGTM after those nits.', d(-7))
        dm(conv_av, amit,   'Thanks! Addressed all 3 comments. Will tag Priya now.', d(-7))

        conv_sp = get_or_create_conv(sunita, pooja)
        dm(conv_sp, sunita, 'Pooja, do you have the expense report for last month ready? Manager asked for it in today\'s standup.', d(-1))
        dm(conv_sp, pooja,  'Yes, I submitted it yesterday to Suresh. Also emailed a PDF copy to the finance inbox. Are they looking for something specific?', d(-1))
        dm(conv_sp, sunita, 'Just the total approved vs pending breakdown. I can pull it from the system — never mind!', d(-1))
        dm(conv_sp, pooja,  'Ha, ok! FYI I also added a new "Miscellaneous" category after getting feedback from the vendors last week.', d(0), is_read=False)

        db.session.flush()

        # ══════════════════════════════════════════════════════════════════════
        # GROUP CHATS
        # ══════════════════════════════════════════════════════════════════════

        def make_group(name, creator, members, created_at):
            g = GroupChat(name=name, created_by=creator.id, created_at=created_at)
            db.session.add(g)
            db.session.flush()
            g.members = members
            db.session.flush()
            return g

        def gm(group, sender, text, at, is_read=True):
            m = Message(content=text, sender_id=sender.id,
                        group_id=group.id, created_at=at,
                        is_read=is_read, message_type='text')
            db.session.add(m)

        # ── Engineering Team ─────────────────────────────────────────────────
        g_eng = make_group('Engineering Team', rajesh,
                           [rajesh, priya, amit, sunita, vikram, arjun], d(-90))

        gm(g_eng, rajesh, 'Welcome everyone to the Engineering Team group! Use this for daily updates, blockers, and quick coordination.', d(-90))
        gm(g_eng, priya,  'Thanks Rajesh. @Amit @Sunita — please post your standup update here by 9:30 AM every morning.', d(-89))
        gm(g_eng, amit,   '9:30 works. Should we use a fixed format? "Yesterday / Today / Blockers"?', d(-89))
        gm(g_eng, priya,  'Yes, exactly that format. Keep it short — max 3 bullet points per section.', d(-89))
        gm(g_eng, sunita, 'Noted!', d(-89))
        gm(g_eng, arjun,  'Should I include server health updates here too or keep that in the infra channel?', d(-88))
        gm(g_eng, rajesh, 'Critical infra issues here. Routine health logs go in #ops-monitoring separately.', d(-88))

        gm(g_eng, amit,   'Yesterday: Completed JWT auth unit tests (18/18 passing). Today: Starting task assignment refactor. Blockers: None.', d(-70))
        gm(g_eng, sunita, 'Yesterday: Finished API endpoint documentation for v1. Today: Profiling task-list endpoint with py-spy. Blockers: Need prod query logs from Rajesh.', d(-70))
        gm(g_eng, rajesh, '@Sunita I will drop the slow query log export into the shared drive folder /logs/prod-slow-queries/ now.', d(-70))

        gm(g_eng, vikram, 'Heads up — deployed t2 (RDS setup) to prod. All smoke tests green. DB is live ✅', d(-68))
        gm(g_eng, rajesh, 'Nice work @Vikram! Everyone update your local .env with the new DATABASE_URL from SSM.', d(-68))

        gm(g_eng, amit,   'PR #147 is up for the Redux tasks slice migration. @Vikram already reviewed. @Priya tagging you for final approval.', d(-7))
        gm(g_eng, priya,  '@Amit reviewed and merged. Clean implementation! The RTK Query caching is going to save us a lot of redundant fetches.', d(-6))
        gm(g_eng, sunita, '@Amit great work on the optimistic update — UI feels much snappier now.', d(-6))
        gm(g_eng, amit,   'Thanks team! Next up: wiring the notifications slice. Should be done by EOW.', d(-6))

        gm(g_eng, arjun,  'Daily health check: EC2 ✅ CPU 34%, RDS ✅ connections 18/100, API p99 ✅ 142ms. All green.', d(-1))
        gm(g_eng, rajesh, 'Good. Keep an eye on the RDS connections — we had a spike earlier this week.', d(-1))
        gm(g_eng, arjun,  'Already set a CloudWatch alarm at 80 connections. Will alert to group via webhook.', d(-1))

        gm(g_eng, priya,  '🚨 Reminder: UAT for Portal v2 starts April 5. All in-progress engineering tasks need to be code-complete and deployed to staging by April 3. Please review your task cards and flag anything at risk.', d(0), is_read=False)
        gm(g_eng, amit,   'Redux migration should be done by April 2. No risk.', d(0), is_read=False)
        gm(g_eng, sunita, 'Analytics dashboard — charting components are done. Wiring to real endpoints today. On track for April 3.', d(0), is_read=False)
        gm(g_eng, vikram, 'Field inspection screen — offline queue is the last piece. Will need until April 4. Can we extend staging freeze by 1 day?', d(0), is_read=False)
        gm(g_eng, priya,  '@Vikram yes, I can extend staging freeze to April 4 EOD. But that is the hard deadline — no more extensions.', d(0), is_read=False)

        # ── Portal v2 — War Room ──────────────────────────────────────────────
        g_portal = make_group('Portal v2 — War Room', priya,
                              [rajesh, priya, amit, sunita], d(-30))

        gm(g_portal, priya,  'Creating this group for Portal v2 release coordination. Go-live target: April 25. T-28 days.', d(-30))
        gm(g_portal, rajesh, 'Let\'s use this for daily status. I want a traffic-light update every morning: 🟢 on track / 🟡 at risk / 🔴 blocked.', d(-30))
        gm(g_portal, amit,   '🟢 Auth + task APIs — on track.', d(-29))
        gm(g_portal, sunita, '🟢 Analytics dashboard — on track.', d(-29))
        gm(g_portal, priya,  '🟡 Dark mode — slightly behind. Not on critical path for go-live though.', d(-29))

        gm(g_portal, sunita, '🔴 BLOCKER — Chart.js is hanging for 600ms on datasets > 1000 entries. Raised as Issue on task #13. @Amit any ideas?', d(-10))
        gm(g_portal, amit,   'Yes — switch to virtualised rendering. Use react-window + a canvas-based chart. I can pair with you on this today.', d(-10))
        gm(g_portal, sunita, 'Let\'s do 2 PM. Thanks @Amit.', d(-10))
        gm(g_portal, rajesh, 'Good. This needs to be resolved before UAT. Clients will have data going back 6 months.', d(-9))
        gm(g_portal, amit,   'Fixed! Switched to virtualised canvas rendering. 1000-entry dataset now renders in <80ms. @Sunita PR is up — #151.', d(-8))
        gm(g_portal, sunita, 'PR #151 reviewed and merged. Performance issue resolved ✅', d(-8))

        gm(g_portal, priya,  'UAT test case doc is in Google Drive. @Amit @Sunita please each review 2 sections by tomorrow EOD.', d(-1))
        gm(g_portal, amit,   'Will review sections 3 and 4 (task management + notifications).', d(-1))
        gm(g_portal, sunita, 'Will review sections 5 and 6 (analytics + reports).', d(-1))

        # ── Ops Daily Coordination ────────────────────────────────────────────
        g_ops = make_group('Ops Daily Coordination', suresh,
                           [suresh, kavitha, vikram, pooja], d(-60))

        gm(g_ops, suresh,  'Group for daily ops coordination. @Kavitha @Pooja please post shift summaries here each evening.', d(-60))
        gm(g_ops, kavitha, 'Understood. Will post by 6 PM daily.', d(-60))
        gm(g_ops, pooja,   'Got it!', d(-60))

        gm(g_ops, kavitha, 'Shift summary 27-Mar: All 5 field staff completed their assigned zones. 2 incidents logged (minor). Equipment: Forklift #3 needs maintenance — raised work order.', d(-1))
        gm(g_ops, suresh,  '@Kavitha get forklift #3 into maintenance first thing tomorrow. Do not deploy it until cleared.', d(-1))
        gm(g_ops, kavitha, 'Already done. Maintenance is scheduled for 7 AM tomorrow.', d(-1))
        gm(g_ops, pooja,   'Expense report for March submitted. Total approved: ₹1,84,500. Pending: ₹23,200 (2 items awaiting manager approval @Suresh).', d(-1))
        gm(g_ops, suresh,  '@Pooja I will review and approve the 2 pending items tonight.', d(-1))

        gm(g_ops, vikram,  'TechServ API sandbox is set up. Running first integration tests now. Seeing some field mapping mismatches — will document and send to TechServ today.', d(0), is_read=False)
        gm(g_ops, kavitha, '@Vikram keep me posted. We need this live by April 8 for the vendor go-live.', d(0), is_read=False)

        # ── All Hands ─────────────────────────────────────────────────────────
        g_all = make_group('All Hands 📢', suresh,
                           [rajesh, suresh, priya, kavitha, amit, sunita, vikram, pooja, arjun], d(-90))

        gm(g_all, suresh, 'Welcome to All Hands! Company-wide announcements will be posted here.', d(-90))
        gm(g_all, suresh, '📢 Company update: Q1 targets met! Revenue up 18% YoY. Great work everyone. Q2 kickoff meeting is March 30 at 11 AM in the main conference room.', d(-2))
        gm(g_all, rajesh, 'Congratulations team! Q2 is going to be even bigger with Portal v2 going live.', d(-2))
        gm(g_all, priya,  'Excited for Q2! Engineering team is ready 💪', d(-2))
        gm(g_all, kavitha,'Ops team is fully prepped too!', d(-2))
        gm(g_all, amit,   '🎉', d(-1))
        gm(g_all, arjun,  '🎉', d(-1))
        gm(g_all, suresh, '📢 Reminder: Q2 kickoff is TOMORROW March 30 at 11 AM. Attendance mandatory for all team leads. Others are welcome.', d(0), is_read=False)

        # ── Mobile App Sprint ─────────────────────────────────────────────────
        g_mobile = make_group('Mobile App Sprint', priya,
                              [priya, amit, vikram], d(-20))

        gm(g_mobile, priya,  'Sprint group for Mobile App Revamp. Current sprint ends April 11. Focus: field inspection screen + offline sync.', d(-20))
        gm(g_mobile, vikram, 'Inspection screen UI is done. Starting camera capture integration today.', d(-18))
        gm(g_mobile, amit,   'I will start the offline sync engine design doc this week. Will share for review before coding.', d(-18))
        gm(g_mobile, priya,  '@Amit sync engine design doc needs to be ready by April 1 so we can review before sprint ends.', d(-17))
        gm(g_mobile, amit,   'Confirmed. April 1 for design doc.', d(-17))
        gm(g_mobile, vikram, 'Camera capture done. GPS tagging next. @Priya should GPS be optional or mandatory on inspection reports?', d(-10))
        gm(g_mobile, priya,  'Mandatory for field inspections, optional for office-submitted reports. Add a permission check for location access.', d(-10))
        gm(g_mobile, vikram, 'Got it. Will add permission check with a user-facing prompt.', d(-10))
        gm(g_mobile, amit,   'Design doc for offline sync is up in Confluence: /spaces/MOB/offline-sync-design. Please review @Priya @Vikram.', d(-1), is_read=False)
        gm(g_mobile, priya,  'Will review today. @Vikram please also check the conflict resolution section.', d(0), is_read=False)

        db.session.commit()
        print("\n✅ Full seed complete. Summary:")
        print(f"  Departments : {db.session.query(Department).count()}")
        print(f"  Projects    : {db.session.query(Project).count()}")
        print(f"  Tasks       : {db.session.query(Task).count()}")
        print(f"  Subtasks    : {db.session.query(Subtask).count()}")
        print(f"  Issues      : {db.session.query(Issue).count()}")
        print(f"  Comments    : {db.session.query(Comment).count()}")
        print(f"  Requirements: {db.session.query(Requirement).count()}")
        print(f"  Group chats : {db.session.query(GroupChat).count()}")
        print(f"  DM convos   : {db.session.query(Conversation).count()}")
        print(f"  Messages    : {db.session.query(Message).count()}")

if __name__ == '__main__':
    seed()
