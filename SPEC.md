# Big Mother

A web app that helps long day care centres stay compliant and keeps parents informed. It tracks staff credentials and compliance requirements so directors can see what needs attention at a glance, and gives educators a simple way to share updates with families.

## Problem
Long day care owners and directors must continuously manage a large and changing range of compliance and operational requirements across staff, children and the centre. Tracking this manually causes administrative burnout and risks non-compliance penalties or expired staff credentials. Parents also get little timely information about their child's day.

## Who uses it
- **Owners and directors:** responsible for compliance, staff credentials and audit-readiness
- **Educators:** record incidents and share updates about children
- **Parents:** follow their child's day and message the centre

## What they can do

**Owners and directors**
- See a home screen showing expired and expiring staff certificates, overdue compliance items and overdue incident notices
- Track every staff member's certificates (WWCC, first aid, CPR, anaphylaxis, asthma, qualifications) and their expiry dates
- Get automatic reminders sent to staff before a certificate expires
- Keep compliance records against national requirements, with evidence attached
- Read an AI-generated summary of the centre's compliance status, traceable back to the records it was built from

**Educators**
- Log incidents, and flag serious ones so the 24-hour parent and regulator notifications are tracked
- Post daily updates, observations and photos for families
- Message parents

**Parents**
- View published updates and incidents for their own children only
- Send and receive messages with the centre

## Data
- centres: id, name, suburb, state, created_at
- users: id, centre_id, full_name, email, phone, role (owner, director, educator, parent), preferred_language, created_at
- staff: id, centre_id, user_id, full_name, email, phone, position, is_active, created_at
- certificate_types: id, code, name, expires, reminder_days
- staff_certificates: id, staff_id, certificate_type_id, certificate_number, issue_date, expiry_date, document_url, created_at
- reminders: id, staff_certificate_id, channel, send_at, status, sent_at
- compliance_requirements: id, centre_id, title, regulation_reference, category, frequency, is_active
- compliance_records: id, centre_id, requirement_id, status, due_date, completed_on, completed_by, evidence_url, notes, created_at
- compliance_summaries: id, centre_id, summary, source_record_ids, model, generated_at
- incidents: id, centre_id, child_id, reported_by, occurred_at, description, action_taken, is_serious, parent_notified_at, regulator_notified_at, created_at
- children: id, centre_id, first_name, last_name, date_of_birth, room, is_active, created_at
- child_parents: child_id, user_id, relationship
- updates: id, centre_id, child_id, author_id, kind, title, body, media_urls, published_at, created_at
- messages: id, centre_id, child_id, sender_id, body, sent_at, read_at

**Calculated views (not stored)**
- v_certificate_status: valid, expiring soon or expired, worked out from the expiry date
- v_incident_deadlines: whether the 24-hour parent notification is pending, overdue or done
- v_centre_overview: one row per centre for the director's home screen

## Out of scope for now
- Billing, invoices and subsidies
- Timetables, bookings and attendance sign-in/out
- Voice notes for educators
- Multi-language translation of content
- Curriculum planning and learning outcomes
- Staff rosters and ratio calculations
- Native mobile apps (web only)
