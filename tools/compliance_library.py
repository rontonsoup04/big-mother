"""Beehive compliance library: one source of truth for the official documents
behind each checklist item.

Run:  python3 tools/compliance_library.py
Writes:
  supabase/migrations/20261026090000_compliance_library.sql  (tables + data)
  beehive-demo/library-data.js                               (offline demo copy)

Every document below was checked against the issuing government site on CHECKED.
Summaries and directions are plain-English guidance, not legal advice.
"""
import json
import os

CHECKED = "2026-10-25"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

REGS_URL = "https://legislation.nsw.gov.au/view/html/inforce/current/sl-2011-0653"
ACECQA = "ACECQA (Australian Government and all states)"
NSW_DOE = "NSW Department of Education"
NSW_ELC = "NSW Early Learning Commission"
OCG = "NSW Office of the Children's Guardian"


def regs_doc(refs):
    return {"title": "Education and Care Services National Regulations · " + refs, "issuer": "NSW Legislation (applies nationally)",
            "doc_type": "Regulation", "jurisdiction": "National", "published": "Current version", "url": REGS_URL}


GENERAL = [
    {"title": "Education and Care Services National Regulations", "issuer": "NSW Legislation (applies nationally)", "doc_type": "Regulation",
     "jurisdiction": "National", "published": "Current version", "url": REGS_URL,
     "note": "The legal requirements every checklist item comes from. Check the current version for recent amendments."},
    {"title": "National Law and Regulations", "issuer": ACECQA, "doc_type": "Overview", "jurisdiction": "National", "published": "",
     "url": "https://www.acecqa.gov.au/nqf/national-law-regulations",
     "note": "Plain-English overview of the Education and Care Services National Law and Regulations, with links to each state's version."},
    {"title": "Guide to the National Quality Framework", "issuer": ACECQA, "doc_type": "Guide", "jurisdiction": "National", "published": "",
     "url": "https://www.acecqa.gov.au/nqf/about/guide",
     "note": "Explains each regulation and what assessors look for during assessment and rating."},
    {"title": "National Quality Standard", "issuer": ACECQA, "doc_type": "Standard", "jurisdiction": "National", "published": "",
     "url": "https://www.acecqa.gov.au/nqf/national-quality-standard",
     "note": "The 7 quality areas services are assessed and rated against."},
    {"title": "Sample forms and templates", "issuer": ACECQA, "doc_type": "Templates", "jurisdiction": "National", "published": "",
     "url": "https://acecqa.gov.au/node/334296",
     "note": "Official templates for enrolment, staff, incident, medication and other records."},
    {"title": "About the Early Learning Commission", "issuer": NSW_ELC, "doc_type": "Regulator", "jurisdiction": "NSW", "published": "Operating since 1 Dec 2025",
     "url": "https://education.nsw.gov.au/early-childhood-education/regulation-and-compliance/about-the-early-learning-commission.html",
     "note": "The independent NSW regulator for early childhood education and care. It assesses services, enforces the National Law and Regulations, and receives notifications."},
    {"title": "Notifications and reporting", "issuer": NSW_ELC, "doc_type": "Guidance", "jurisdiction": "NSW", "published": "",
     "url": "https://education.nsw.gov.au/early-childhood-education/regulation-and-compliance/notifications-and-reporting.html",
     "note": "How long day care services notify the regulator through the NQA IT System. Phone 1800 619 113."},
    {"title": "Compliance focus: effective record keeping", "issuer": NSW_DOE, "doc_type": "Guidance", "jurisdiction": "NSW", "published": "Updated 7 Jul 2025",
     "url": "https://education.nsw.gov.au/early-childhood-education/leadership/news/compliance-spotlight--effective-record-keeping-",
     "note": "How long to keep each type of record under regulation 183."},
]

GUIDES = [
    {
        "item_key": "wwcc", "area": "staff_records", "title": "Current WWCC register",
        "source_ref": "National Regulations · Reg. 145–147 · NSW WWCC",
        "summary": "Everyone working or volunteering with children needs a current Working With Children Check. The staff record must hold each person's WWCC number and expiry date, and in NSW the employer must verify every Check online and record the result.",
        "directions": [
            "Before someone starts, verify their WWCC clearance number online with the Office of the Children's Guardian. Education workers need a clearance number, not only an application number.",
            "Record each person's full name, date of birth, WWCC number, verification date and outcome, expiry date, and whether the role is paid or voluntary.",
            "Verify again online whenever a Check is renewed. Checks last 5 years and can be renewed up to 3 months before expiry.",
            "Remove anyone whose Check is barred, interim barred, not found or expired from child-related work straight away.",
            "Have a second authorised person verify the verifier's own Check. Nobody can verify their own.",
        ],
        "evidence": "Staff record with a WWCC number, expiry date and online verification date for every staff member, volunteer and student.",
        "retention": "Staff records: 3 years after the person stops working at the service (Reg. 183).",
        "documents": [
            {"title": "Role of an employer with the Working with Children Check", "issuer": OCG, "doc_type": "Guidance", "jurisdiction": "NSW", "published": "",
             "url": "https://ocg.nsw.gov.au/working-children-check/organisation/role-employer",
             "note": "Verifying Checks, what to record, renewals and when to remove someone from child-related work."},
            {"title": "Staff record (regulation 145)", "issuer": ACECQA, "doc_type": "Template", "jurisdiction": "National", "published": "",
             "url": "https://acecqa.gov.au/media/22741",
             "note": "Official template for the staff record, including WWCC number and expiry for each person."},
            regs_doc("Reg. 145–147"),
        ],
    },
    {
        "item_key": "firstaid", "area": "staff_records", "title": "First Aid and CPR evidence",
        "source_ref": "National Regulations · Reg. 136",
        "summary": "At all times children are present, at least one staff member with a current approved first aid qualification, one with approved anaphylaxis management training and one with approved emergency asthma management training must be on site and immediately available. One person can hold all three.",
        "directions": [
            "Check each certificate against ACECQA's approved first aid qualifications list, using the course code on the certificate.",
            "Roster so someone holding each of the three qualifications is on site for every hour you're open, including early, late and excursion shifts.",
            "Track expiry dates. Industry practice is to renew first aid, anaphylaxis and asthma training every 3 years and CPR every 12 months. Check each certificate for its own renewal requirement.",
            "Keep a copy of every certificate on the staff record.",
        ],
        "evidence": "Current certificates on staff records, and rosters showing qualified staff on site at all times.",
        "retention": "Staff records: 3 years after the person stops working at the service (Reg. 183).",
        "documents": [
            {"title": "First aid qualifications & training", "issuer": ACECQA, "doc_type": "Guidance", "jurisdiction": "National", "published": "",
             "url": "https://www.acecqa.gov.au/qualifications/requirements/first-aid-qualifications-training",
             "note": "Who must hold first aid, anaphylaxis and asthma training, and renewal guidance."},
            {"title": "NQF approved qualifications list", "issuer": ACECQA, "doc_type": "Register", "jurisdiction": "National", "published": "",
             "url": "https://www.acecqa.gov.au/qualifications/nqf-approved",
             "note": "Search a course name or code to confirm it's approved."},
            regs_doc("Reg. 136"),
        ],
    },
    {
        "item_key": "training", "area": "staff_records", "title": "Staff qualification and training records",
        "source_ref": "National Regulations · Reg. 84, 145–147 · National Law s162A",
        "summary": "Staff records must show each person's qualifications and approved training. Everyone working with children must keep up to date with child protection law and their mandatory reporting duties. In NSW, nominated supervisors and persons in day-to-day charge need approved child protection training, and everyone working at a service needs national child safety training.",
        "directions": [
            "Keep a copy of each person's qualification, or proof of enrolment in an approved course, plus their other approved training, on the staff record.",
            "Make sure nominated supervisors and persons in day-to-day charge have completed approved child protection training (CHCPRT025 or CHCPRT026). In-house training doesn't count.",
            "Have every new worker complete national child safety training within 14 days of starting, or before working directly with children if that's sooner, and refresh it every 2 years.",
            "Brief staff on child protection law and how to make a report. Nominated supervisors must be able to explain these obligations (Reg. 84).",
            "Check qualifications against ACECQA's approved qualifications list.",
        ],
        "evidence": "Staff records with copies of qualifications and training, and a register of child protection and child safety training dates.",
        "retention": "Staff records: 3 years after the person stops working at the service (Reg. 183).",
        "documents": [
            {"title": "Child protection and child safety training requirements", "issuer": NSW_DOE, "doc_type": "Guidance", "jurisdiction": "NSW", "published": "Updated 1 Oct 2026",
             "url": "https://education.nsw.gov.au/early-childhood-education/regulation-and-compliance/regulation-assessment-and-rating/child-safety/child-protection-training-requirements",
             "note": "Who needs which course, approved course codes and refresher timing."},
            {"title": "Staff record (regulation 145)", "issuer": ACECQA, "doc_type": "Template", "jurisdiction": "National", "published": "",
             "url": "https://acecqa.gov.au/media/22741", "note": "Includes qualification and training fields."},
            {"title": "NQF approved qualifications list", "issuer": ACECQA, "doc_type": "Register", "jurisdiction": "National", "published": "",
             "url": "https://www.acecqa.gov.au/qualifications/nqf-approved", "note": "Confirm an educator's qualification is approved."},
            regs_doc("Reg. 84, 145–147"),
        ],
    },
    {
        "item_key": "enrolment", "area": "childrens_records", "title": "Children’s enrolment and contact records",
        "source_ref": "National Regulations · Reg. 160–162",
        "summary": "Keep an enrolment record for every child with their details, each parent's contacts, an emergency contact, authorised nominees, people who can consent to medical treatment, outings or transport, any court or parenting orders, and health information including their doctor.",
        "directions": [
            "Use a complete enrolment form (ACECQA has a template). Don't leave fields blank: write \"not provided\" and note what the service will do.",
            "Record contacts for each parent, an emergency contact for when no parent can be reached, authorised nominees, and anyone who can consent to medical treatment, outings or transport.",
            "Record the child's doctor and any health need, allergy or medical condition (Reg. 162).",
            "Keep copies of any court orders, parenting orders or parenting plans you've been given.",
            "Check immunisation documents meet NSW requirements before the child starts.",
            "Review contacts, authorised people and medical details with each family at least every 12 months, and whenever things change.",
        ],
        "evidence": "A complete enrolment record for every child, with the date it was last reviewed.",
        "retention": "Child records: 3 years after the child's last day at the service (Reg. 183).",
        "documents": [
            {"title": "QA7 – Development of child enrolment record", "issuer": ACECQA, "doc_type": "Information sheet", "jurisdiction": "National", "published": "May 2025",
             "url": "https://www.acecqa.gov.au/qa7-development-child-enrolment-record",
             "note": "Everything the enrolment record must contain, with practical tips."},
            {"title": "ACECQA child enrolment record template", "issuer": NSW_DOE, "doc_type": "Template", "jurisdiction": "NSW", "published": "",
             "url": "https://education.nsw.gov.au/early-childhood-education/ecec-resource-library/acecqa-child-enrolment-record-template",
             "note": "The official enrolment template, shared in the NSW resource library."},
            regs_doc("Reg. 160–162"),
        ],
    },
    {
        "item_key": "incidents", "area": "childrens_records", "title": "Incident, injury, trauma and illness records",
        "source_ref": "National Regulations · Reg. 85–87, 176 · National Law s174",
        "summary": "Have incident, injury, trauma and illness procedures. Record each incident as soon as possible and within 24 hours, tell the parent as soon as practicable and within 24 hours, and notify the regulator of any serious incident within 24 hours.",
        "directions": [
            "Complete the incident record as soon as possible and within 24 hours, including what happened, the action taken and who was told.",
            "Tell the parent or carer as soon as practicable, and no later than 24 hours after the incident.",
            "For a serious incident, notify the NSW Early Learning Commission through the NQA IT System within 24 hours.",
            "Store records confidentially.",
            "Review incidents regularly for patterns and update your risk assessments.",
        ],
        "evidence": "Incident records showing when the parent was told, and NQA IT System receipts for serious incidents.",
        "retention": "Incident, injury, trauma and illness records: until the child turns 25 (Reg. 183).",
        "documents": [
            {"title": "Incident, injury, trauma and illness: Policy and procedure guidelines", "issuer": ACECQA, "doc_type": "Guidelines", "jurisdiction": "National", "published": "Mar 2026",
             "url": "https://www.acecqa.gov.au/media/31971",
             "note": "What your policy should cover, recording within 24 hours and keeping records until the child is 25."},
            {"title": "QA2 – Managing and responding to injury, trauma and illness incidents", "issuer": ACECQA, "doc_type": "Information sheet", "jurisdiction": "National", "published": "Sep 2025",
             "url": "https://www.acecqa.gov.au/qa2-managing-and-responding-injury-trauma-and-illness-incidents",
             "note": "Parent and regulator notification timeframes for serious incidents."},
            {"title": "Notifications and reporting", "issuer": NSW_ELC, "doc_type": "Guidance", "jurisdiction": "NSW", "published": "",
             "url": "https://education.nsw.gov.au/early-childhood-education/regulation-and-compliance/notifications-and-reporting.html",
             "note": "How to notify the NSW regulator. Phone 1800 619 113."},
            regs_doc("Reg. 85–87, 176"),
        ],
    },
    {
        "item_key": "medical", "area": "childrens_records", "title": "Medical management and risk minimisation records",
        "source_ref": "National Regulations · Reg. 90–96, 162",
        "summary": "Have a medical conditions policy, even if no child currently has a condition. For each child with a diagnosed condition such as asthma, diabetes or anaphylaxis risk, keep a medical management plan from the parent, a risk minimisation plan and a communication plan. Give parents the policy and record any medication given.",
        "directions": [
            "Ask about health needs, allergies and medical conditions at enrolment and again when the child starts.",
            "Get the child's medical management plan (for example an ASCIA action plan) from the family before the child attends.",
            "Write a risk minimisation plan and a communication plan with the family. ACECQA has a template.",
            "Give the family a copy of your medical conditions policy.",
            "Brief all staff, including casuals, volunteers and students, and show them where each child's medication is kept.",
            "Check medication expiry dates regularly, and review plans with the family when the child's needs change.",
        ],
        "evidence": "Medical management, risk minimisation and communication plans on each child's record, plus medication records.",
        "retention": "Child records, including medication records: 3 years after the child's last day at the service (Reg. 183).",
        "documents": [
            {"title": "QA2 – Guidance for medical management plans, risk minimisation and communication plans (Part B)", "issuer": ACECQA, "doc_type": "Information sheet", "jurisdiction": "National", "published": "",
             "url": "https://www.acecqa.gov.au/qa2-information-sheet-guidance-medical-management-plans-risk-minimisation-and-communication-plans",
             "note": "Practical steps for managing children's medical conditions."},
            {"title": "Unpacking regulation 90 (fact sheet)", "issuer": NSW_DOE, "doc_type": "Fact sheet", "jurisdiction": "NSW", "published": "",
             "url": "https://education.nsw.gov.au/content/dam/main-education/early-childhood-education/whats-happening-in-the-early-childhood-education-sector/media/ece-resources/oshc-medical-management-toolbox/Topic_6_fact_sheet_Unpacking_regulation_90.pdf",
             "note": "What the medical conditions policy must include."},
            {"title": "Anaphylaxis and allergy prevention and management", "issuer": NSW_DOE, "doc_type": "Resource", "jurisdiction": "NSW", "published": "",
             "url": "https://education.nsw.gov.au/early-childhood-education/ecec-resource-library/anaphylaxis-and-allergy-prevention-and-management",
             "note": "NSW resources for children at risk of anaphylaxis."},
            regs_doc("Reg. 90–96, 162"),
        ],
    },
    {
        "item_key": "authorisations", "area": "childrens_records", "title": "Authorisations and child collection records",
        "source_ref": "National Regulations · Reg. 99, 102, 158, 161",
        "summary": "A child may only leave with a parent, an authorised nominee named in their enrolment record, or someone a parent or nominee has authorised. Otherwise it must be with written authorisation, for an excursion or service transport, or because of a medical emergency. Record each arrival and departure with the signature of the person dropping off or collecting.",
        "directions": [
            "Keep each child's authorised nominees, with contact details, in their enrolment record.",
            "Check the identity of anyone staff don't know before handing over a child, for example with photo ID.",
            "Have the attendance record signed at every drop-off and pick-up, with the date and time.",
            "Get written authorisation for excursions and regular outings. Authorisations for regular outings must be renewed at least every 12 months.",
            "Have a procedure for when an unauthorised or unfit person tries to collect a child, and for children who aren't collected.",
            "Do a final check at closing so no child is left on the premises.",
        ],
        "evidence": "Signed attendance records, authorisations in enrolment records, and excursion permissions.",
        "retention": "Child records, including attendance: 3 years after the child's last day at the service (Reg. 183).",
        "documents": [
            {"title": "Delivery of children to, and collection from, education and care service premises: Policy guidelines", "issuer": ACECQA, "doc_type": "Guidelines", "jurisdiction": "National", "published": "Jul 2023",
             "url": "https://acecqa.gov.au/media/32241",
             "note": "Who can collect a child, attendance records and what your procedures should cover."},
            {"title": "QA7 – Development of child enrolment record", "issuer": ACECQA, "doc_type": "Information sheet", "jurisdiction": "National", "published": "May 2025",
             "url": "https://www.acecqa.gov.au/qa7-development-child-enrolment-record",
             "note": "Authorisations that belong in the enrolment record."},
            regs_doc("Reg. 99, 102, 158, 161"),
        ],
    },
    {
        "item_key": "evacuation", "area": "safety_premises", "title": "Emergency evacuation drill logged this quarter",
        "source_ref": "National Regulations · Reg. 97, 98",
        "summary": "Have emergency and evacuation procedures based on a risk assessment of the emergencies that could affect your service. Rehearse every procedure (for example evacuation and lockdown) every 3 months and record each rehearsal.",
        "directions": [
            "Do a risk assessment of the emergencies that could affect your service, and review it at least every 12 months.",
            "Rehearse each procedure every 3 months. Vary the day and time so every child and staff member takes part over the year.",
            "Record each rehearsal: date, time, which procedure, who took part, how long it took and what to improve. The nominated supervisor keeps these records.",
            "Display the evacuation floor plan and instructions in a prominent position near each exit.",
            "Make sure staff can always reach a phone or other way to call for help (Reg. 98).",
        ],
        "evidence": "A rehearsal record dated within the last 3 months for each procedure, the current risk assessment, and floor plans on display.",
        "retention": "",
        "documents": [
            {"title": "Emergency and evacuation: Policy and procedure guidelines", "issuer": ACECQA, "doc_type": "Guidelines", "jurisdiction": "National", "published": "Mar 2026",
             "url": "https://www.acecqa.gov.au/media/31951",
             "note": "Risk assessment, rehearsing every 3 months, recording rehearsals and displaying floor plans."},
            regs_doc("Reg. 97, 98"),
        ],
    },
    {
        "item_key": "premises", "area": "safety_premises", "title": "Premises and safety checks",
        "source_ref": "National Regulations · Reg. 103–115",
        "summary": "Premises, furniture and equipment must be safe, clean and in good repair. The service also needs fencing, enough indoor and outdoor space, shade, toilets, nappy change areas, and a layout that lets educators supervise children.",
        "directions": [
            "Do a documented safety check of indoor and outdoor areas each day before children arrive.",
            "Keep cleaning schedules for toys, equipment and areas children use.",
            "Log repairs and maintenance, and follow manufacturers' advice for equipment.",
            "Check cots, mattresses and bedding meet Australian Standards, and make sure there are no bassinets on the premises (Reg. 84D).",
            "Keep risk assessments of the physical environment, and a plan to protect children during any building work.",
        ],
        "evidence": "Daily safety checklists, a maintenance log and cleaning schedules.",
        "retention": "",
        "documents": [
            {"title": "Element 3.1.2: Upkeep", "issuer": ACECQA, "doc_type": "Guide to the NQF", "jurisdiction": "National", "published": "",
             "url": "https://www.acecqa.gov.au/element-312-upkeep",
             "note": "What assessors look for, and documents they may ask to see."},
            {"title": "Quality Area 3: Physical environment", "issuer": ACECQA, "doc_type": "Guide to the NQF", "jurisdiction": "National", "published": "",
             "url": "https://acecqa.gov.au/national-quality-framework/guide-nqf/section-3-national-quality-standard-and-assessment-and-rating/quality-area-3-physical-environment",
             "note": "Design, upkeep and use of the premises."},
            regs_doc("Reg. 103–115"),
        ],
    },
    {
        "item_key": "emergency", "area": "safety_premises", "title": "Emergency contacts and procedures",
        "source_ref": "National Regulations · Reg. 97, 173 · National Law s172",
        "summary": "Display the evacuation floor plan and instructions near each exit. Display the prescribed service information so it's clearly visible from the main entrance, including approvals, the regulator's contact details, the person in charge and who handles complaints.",
        "directions": [
            "Put the floor plan and evacuation instructions in a prominent position near each exit.",
            "Display at the main entrance: provider and service approvals, your rating, the regulator's contact details, the complaints contact, the nominated supervisor and the person in charge.",
            "Where it applies, display a notice that an enrolled child is at risk of anaphylaxis (without naming them), and any infectious disease notice.",
            "Update the display whenever the person in charge, nominated supervisor or contacts change. A display folder doesn't count.",
            "Keep each room's emergency contact list up to date from the enrolment records.",
        ],
        "evidence": "Photos of the entrance display and the floor plans at each exit, with dates.",
        "retention": "",
        "documents": [
            {"title": "Display of information", "issuer": "Queensland Government (explains the national rule)", "doc_type": "Guidance", "jurisdiction": "National", "published": "",
             "url": "https://earlychildhood.qld.gov.au/regulation/setting-up-a-new-service/display-of-information",
             "note": "The full list of information services must display under s172 and Reg. 173."},
            {"title": "Emergency and evacuation: Policy and procedure guidelines", "issuer": ACECQA, "doc_type": "Guidelines", "jurisdiction": "National", "published": "Mar 2026",
             "url": "https://www.acecqa.gov.au/media/31951", "note": "Displaying floor plans and instructions near each exit."},
            regs_doc("Reg. 97, 173"),
        ],
    },
    {
        "item_key": "sun", "area": "policies_procedures", "title": "Sun Protection Policy reviewed and current",
        "source_ref": "National Regulations · Reg. 114, 168 · NQS 2.2.1",
        "summary": "Centres must provide adequate shade outdoors and have health and safety policies. ACECQA's sun protection guidelines recommend protection whenever the UV Index is 3 or above, using hats, clothing, sunscreen and shade, with educators modelling sun-safe behaviour.",
        "directions": [
            "Check the UV Index each day and use sun protection whenever it's 3 or above.",
            "Require sun-safe hats and clothing (for example \"no hat, no play\").",
            "Keep enough in-date sunscreen. Babies 6 months and younger generally shouldn't use sunscreen.",
            "Check shade across the seasons, and include shade in excursion risk assessments.",
            "Review the policy on a set schedule with a named person responsible. Tell families at least 14 days before changes that significantly affect them.",
        ],
        "evidence": "The current sun protection policy with its review date.",
        "retention": "",
        "documents": [
            {"title": "Sun Protection: Policy and Procedure Guidelines", "issuer": ACECQA, "doc_type": "Guidelines", "jurisdiction": "National", "published": "Aug 2021",
             "url": "https://acecqa.gov.au/sites/default/files/2021-08/SunProtectionGuidelines.pdf",
             "note": "UV Index, hats, sunscreen, shade, role modelling and policy review."},
            regs_doc("Reg. 114, 168"),
        ],
    },
    {
        "item_key": "sleep", "area": "policies_procedures", "title": "Sleep and rest policy review",
        "source_ref": "National Regulations · Reg. 84A–84D · NQS 2.1.1",
        "summary": "Meet each child's sleep and rest needs. Base your sleep and rest policies on a risk assessment done at least every 12 months, and never have bassinets on the premises while children are in care.",
        "directions": [
            "Do a sleep and rest risk assessment at least every 12 months, and as soon as possible when something changes. Keep a record of each one. ACECQA has a template.",
            "Update the policy after each assessment. Cover supervision (how often sleeping children are checked, and how that's recorded), sleep areas, cots and bedding, hazards, temperature, lighting and ventilation.",
            "Remove all bassinets from the premises.",
            "Place babies under 12 months on their back, with head and face uncovered, on a firm, flat, well-fitting mattress in a safe cot.",
            "Train staff on the policy and Red Nose safe sleep guidance, and share the policy with families.",
        ],
        "evidence": "The latest risk assessment record, the policy with its review date, and sleep check records.",
        "retention": "",
        "documents": [
            {"title": "QA2 information sheet – Sleep and rest legislative requirements", "issuer": ACECQA, "doc_type": "Information sheet", "jurisdiction": "National", "published": "May 2026",
             "url": "https://www.acecqa.gov.au/QA2-information-sheet-sleep-and-rest-legislative-requirements",
             "note": "What Regulations 84A to 84D require, with practical steps."},
            {"title": "Sleep and rest risk assessment template", "issuer": ACECQA, "doc_type": "Template", "jurisdiction": "National", "published": "Aug 2026",
             "url": "https://www.acecqa.gov.au/sites/default/files/2026-08/Sleep%20and%20rest%20risk%20assessment%20template.pdf",
             "note": "Rate sleep and rest risks by likelihood and consequence."},
            {"title": "Element 2.1.1: Wellbeing and comfort", "issuer": ACECQA, "doc_type": "Guide to the NQF", "jurisdiction": "National", "published": "",
             "url": "https://www.acecqa.gov.au/national-quality-framework/guide-nqf/section-3-national-quality-standard-and-assessment-and-rating/quality-area-2-childrens-health-and-safety/standard-21-health/element-211-wellbeing-and-comfort",
             "note": "How sleep and rest is assessed."},
            regs_doc("Reg. 84A–84D"),
        ],
    },
    # Guides for recurring compliance tasks that aren't on the audit checklist.
    {
        "item_key": "excursions", "area": "safety_premises", "title": "Excursion risk assessments and authorisations",
        "source_ref": "National Regulations · Reg. 100–102",
        "summary": "Do a risk assessment before every excursion, then get each family's written authorisation before their child goes. A risk assessment for a regular outing stays valid for 12 months unless something changes.",
        "directions": [
            "Complete and record the risk assessment before asking families for authorisation. Cover the destination, travel and planned activities.",
            "For a regular outing, check the risk assessment is less than 12 months old. Update it, and the authorisation forms, if the route, location or number of children changes.",
            "Send families a written authorisation form explaining transport, how long it takes, the activities, and the risks and how you'll manage them.",
            "Have a written authorisation for every child before the day.",
            "Plan ratios and groups around the risks, with a first-aid-qualified educator in each group.",
            "Take the first aid kit, medication, medical management plans, emergency contacts and a phone. Do regular headcounts.",
        ],
        "evidence": "A risk assessment for each excursion and regular outing, and signed authorisations for each child.",
        "retention": "Child records, including authorisations: 3 years after the child's last day at the service (Reg. 183).",
        "documents": [
            {"title": "Excursions: Policy and procedure guidelines", "issuer": ACECQA, "doc_type": "Guidelines", "jurisdiction": "National", "published": "Apr 2026",
             "url": "https://www.acecqa.gov.au/media/31966",
             "note": "Risk assessments, regular outings, authorisations, ratios and what to take."},
            regs_doc("Reg. 100–102"),
        ],
    },
    {
        "item_key": "qip", "area": "policies_procedures", "title": "Quality Improvement Plan reviewed",
        "source_ref": "National Regulations · Reg. 31, 55, 56",
        "summary": "Every service needs a Quality Improvement Plan: a self-assessment against the National Quality Standard, the areas you plan to improve, and your service philosophy. Review and revise it at least once a year, keep the current copy at the service, and give it to the regulator when asked.",
        "directions": [
            "Self-assess your practice against each of the 7 quality areas of the National Quality Standard, the National Law and the Regulations.",
            "Record the areas that need improvement, with goals, steps, who's responsible and a timeframe for each.",
            "Keep the statement of philosophy in the plan current.",
            "Review and revise the plan at least once a year, and whenever the regulator directs.",
            "Keep the current plan at the service, where families and the regulator can see it.",
        ],
        "evidence": "The current Quality Improvement Plan with its last review date.",
        "retention": "",
        "documents": [
            {"title": "Self-assessment and quality improvement planning (Guide to the NQF)", "issuer": ACECQA, "doc_type": "Guide to the NQF", "jurisdiction": "National", "published": "",
             "url": "https://www.acecqa.gov.au/node/1076251",
             "note": "What the plan must contain and how often to review it."},
            {"title": "National Quality Standard", "issuer": ACECQA, "doc_type": "Standard", "jurisdiction": "National", "published": "",
             "url": "https://www.acecqa.gov.au/nqf/national-quality-standard", "note": "The 7 quality areas to assess against."},
            regs_doc("Reg. 31, 55, 56"),
        ],
    },
    # Added Nov 2026 with the fuller requirement list (spot check and assessment focus areas).
    # Not yet re-checked against the official sites: confirm before relying on them.
    {
        "item_key": "child_protection", "area": "staff_records", "title": "Child protection and child safe practice",
        "source_ref": "National Law s162A · National Regulations · Reg. 84, 168",
        "summary": "The nominated supervisor and every staff member must know current child protection law and their obligations under it, including mandatory reporting. The service needs a child safe environment policy that staff follow.",
        "directions": [
            "Make sure the nominated supervisor and each person in day-to-day charge has completed the child protection training your state requires.",
            "Brief every staff member on child protection law and mandatory reporting when they start, and refresh it at least once a year. Keep a record of who attended.",
            "Keep a child safe environment policy and code of conduct that staff have read and signed.",
            "Make sure staff know who to report concerns to and how, including outside the service.",
        ],
        "evidence": "Child protection training records for each staff member, the signed code of conduct and the current child safe environment policy.",
        "retention": "Staff records: 3 years after the staff member leaves (Reg. 183).",
        "documents": [
            {"title": "Office of the Children's Guardian", "issuer": OCG, "doc_type": "Regulator", "jurisdiction": "NSW", "published": "",
             "url": "https://ocg.nsw.gov.au/", "note": "NSW Child Safe Scheme, Child Safe Standards and reportable conduct."},
            regs_doc("Reg. 84, 168"),
        ],
    },
    {
        "item_key": "medication", "area": "childrens_records", "title": "Medication records and authorisations",
        "source_ref": "National Regulations · Reg. 92–96",
        "summary": "Medication can only be given with a parent's written authorisation, and each dose must be recorded: the child, the medication, dose, time, who gave it and who checked it.",
        "directions": [
            "Get written authorisation from the parent before giving any medication, except in an anaphylaxis or asthma emergency.",
            "Record every dose: date, time, medication, dose, how it was given, the educator who gave it and the person who checked it.",
            "Give medication from its original container, with the label and the child's name, and before the use-by date.",
            "Tell the parent and emergency services as soon as possible after emergency medication is given.",
        ],
        "evidence": "The medication record for each child, with parent authorisations.",
        "retention": "Child records: 3 years after the child's last day at the service (Reg. 183).",
        "documents": [regs_doc("Reg. 92–96")],
    },
    {
        "item_key": "food", "area": "safety_premises", "title": "Food safety, nutrition and weekly menu",
        "source_ref": "National Regulations · Reg. 77–80",
        "summary": "Food and drink must be nutritious, enough for each child and suit their dietary needs. Safe food handling must be followed, and a weekly menu of food the service provides must be on display.",
        "directions": [
            "Display this week's menu where families can see it, and keep it accurate.",
            "Check each child's allergies and dietary needs against the menu, and make sure kitchen staff know them.",
            "Follow safe food handling and hygiene practices, with fresh drinking water available at all times.",
            "Keep food safety records, such as fridge temperatures and cleaning, if your food safety program asks for them.",
        ],
        "evidence": "The current weekly menu on display and dietary needs recorded for each child.",
        "retention": "",
        "documents": [regs_doc("Reg. 77–80")],
    },
    {
        "item_key": "program", "area": "policies_procedures", "title": "Educational program and documentation",
        "source_ref": "National Law s168 · National Regulations · Reg. 73–76",
        "summary": "The educational program must be based on an approved learning framework and each child's needs and interests. Document each child's learning and progress, display information about the program, and share it with families.",
        "directions": [
            "Base the program on the Early Years Learning Framework and each child's strengths, needs and interests.",
            "Document each child's assessments or evaluations of learning, and how the program supports them.",
            "Display information about the program at the service.",
            "Share each child's progress with their family when asked, and as part of everyday practice.",
        ],
        "evidence": "The current program and each child's documentation of learning.",
        "retention": "Child records: 3 years after the child's last day at the service (Reg. 183).",
        "documents": [
            {"title": "National Quality Standard", "issuer": ACECQA, "doc_type": "Standard", "jurisdiction": "National", "published": "",
             "url": "https://www.acecqa.gov.au/nqf/national-quality-standard", "note": "Quality Area 1: Educational program and practice."},
            regs_doc("Reg. 73–76"),
        ],
    },
    {
        "item_key": "policies", "area": "policies_procedures", "title": "Required policies and procedures in place",
        "source_ref": "National Regulations · Reg. 168–172",
        "summary": "The service must have every policy and procedure the Regulations list (health and safety, emergencies, incidents, medical conditions, child safe environment, staffing, delivery and collection, excursions, fees, enrolment, complaints and more), follow them, keep them available and give families notice of changes.",
        "directions": [
            "Check your policies against the full list in Reg. 168 and add any that are missing.",
            "Review each policy on a regular cycle and record the review date.",
            "Keep the policies where staff and families can read them.",
            "Give families at least 14 days' notice of a change that affects fees, the way fees are collected, or their child.",
        ],
        "evidence": "The policy folder with each policy's review date.",
        "retention": "",
        "documents": [regs_doc("Reg. 168–172")],
    },
    {
        "item_key": "notifications", "area": "policies_procedures", "title": "Notifications to the regulator",
        "source_ref": "National Law s174 · National Regulations · Reg. 175–176",
        "summary": "Serious incidents, and complaints alleging a serious incident or a breach of the law, must be notified to the regulatory authority within 24 hours. Other changes, such as a new nominated supervisor, have their own deadlines.",
        "directions": [
            "Notify a serious incident through the NQA IT System within 24 hours.",
            "Notify a complaint alleging a serious incident or a breach of the law within 24 hours.",
            "Notify changes such as a new nominated supervisor within the required timeframe.",
            "Keep a copy of every notification with the incident or complaint record.",
        ],
        "evidence": "Copies of notifications made, matched to the incident and complaint records.",
        "retention": "",
        "documents": [
            {"title": "Notifications and reporting", "issuer": NSW_ELC, "doc_type": "Guidance", "jurisdiction": "NSW", "published": "",
             "url": "https://education.nsw.gov.au/early-childhood-education/regulation-and-compliance/notifications-and-reporting.html",
             "note": "How long day care services notify the regulator through the NQA IT System."},
            regs_doc("Reg. 175–176"),
        ],
    },
    {
        "item_key": "digital", "area": "policies_procedures", "title": "Safe use of digital technology and images",
        "source_ref": "National Regulations · Reg. 168",
        "summary": "The service needs a policy on the safe use of digital technologies and online environments, including when and how photos and videos of children are taken, stored and shared.",
        "directions": [
            "Write or update the policy on digital technologies, including personal devices and taking images of children.",
            "Get parents' consent before photos or videos of their child are taken or shared.",
            "Store images securely and only on devices and systems the service controls.",
            "Train staff on the policy and record that they've read it.",
        ],
        "evidence": "The current policy with its review date, and parents' image consents.",
        "retention": "",
        "documents": [regs_doc("Reg. 168")],
    },
]


def q(s):
    if s is None or s == "":
        return "null"
    return "'" + str(s).replace("'", "''") + "'"


def arr(items):
    return "array[" + ", ".join(q(x) for x in items) + "]::text[]"


def build_sql():
    out = [f"""-- Beehive compliance library: official documents behind each checklist item,
-- with a plain-English summary and steps to comply. Reference data shared by all centres.
-- Generated by tools/compliance_library.py (sources checked {CHECKED}). Edit that file, not this one.

create table if not exists public.compliance_guides (
  item_key     text primary key,
  area         public.checklist_area not null,
  title        text not null,
  source_ref   text not null,
  summary      text not null,
  directions   text[] not null default '{{}}',
  evidence     text not null default '',
  retention    text not null default '',
  sort         int not null default 0,
  checked_on   date not null
);

create table if not exists public.compliance_documents (
  id           uuid primary key default gen_random_uuid(),
  item_key     text references public.compliance_guides (item_key) on delete cascade,  -- null = general reference
  title        text not null,
  issuer       text not null,
  doc_type     text not null,
  jurisdiction text not null default 'National',
  published    text not null default '',
  url          text not null check (url like 'https://%'),
  note         text not null default '',
  sort         int not null default 0,
  checked_on   date not null
);
create index if not exists compliance_documents_item_idx on public.compliance_documents (item_key, sort);

alter table public.compliance_guides enable row level security;
alter table public.compliance_documents enable row level security;
drop policy if exists "signed-in users read guides" on public.compliance_guides;
create policy "signed-in users read guides" on public.compliance_guides for select to authenticated using (true);
drop policy if exists "signed-in users read documents" on public.compliance_documents;
create policy "signed-in users read documents" on public.compliance_documents for select to authenticated using (true);
grant select on public.compliance_guides, public.compliance_documents to authenticated;

-- Re-runnable: replace the library contents.
delete from public.compliance_documents;
delete from public.compliance_guides;
"""]
    for i, g in enumerate(GUIDES):
        out.append(
            "insert into public.compliance_guides (item_key, area, title, source_ref, summary, directions, evidence, retention, sort, checked_on) values\n"
            f"  ({q(g['item_key'])}, {q(g['area'])}, {q(g['title'])}, {q(g['source_ref'])},\n   {q(g['summary'])},\n   {arr(g['directions'])},\n"
            f"   {q(g['evidence'])}, '{g['retention'].replace(chr(39), chr(39)*2)}', {i + 1}, '{CHECKED}');")
    rows = []
    for i, d in enumerate(GENERAL):
        rows.append((None, d, i + 1))
    for g in GUIDES:
        for i, d in enumerate(g["documents"]):
            rows.append((g["item_key"], d, i + 1))
    out.append("insert into public.compliance_documents (item_key, title, issuer, doc_type, jurisdiction, published, url, note, sort, checked_on) values")
    vals = []
    for key, d, s in rows:
        vals.append(f"  ({q(key)}, {q(d['title'])}, {q(d['issuer'])}, {q(d['doc_type'])}, {q(d['jurisdiction'])}, '{d.get('published', '').replace(chr(39), chr(39)*2)}', {q(d['url'])}, '{d.get('note', '').replace(chr(39), chr(39)*2)}', {s}, '{CHECKED}')")
    out.append(",\n".join(vals) + ";")
    out.append("""
-- Checklist items cite the regulations from the library (existing and future items).
update public.checklist_items c set source_ref = g.source_ref
  from public.compliance_guides g where g.item_key = c.item_key and c.source_ref <> g.source_ref;

create or replace function public._checklist_source_from_library()
returns trigger language plpgsql set search_path = public as $$
declare v_ref text;
begin
  if new.item_key is not null then
    select g.source_ref into v_ref from compliance_guides g where g.item_key = new.item_key;
    if v_ref is not null then new.source_ref := v_ref; end if;
  end if;
  return new;
end $$;
drop trigger if exists checklist_source_from_library on public.checklist_items;
create trigger checklist_source_from_library before insert on public.checklist_items
  for each row execute function public._checklist_source_from_library();

-- One guide with its documents, for the app and the agent.
create or replace function public._guide_json(p_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'item_key', g.item_key, 'title', g.title, 'source_ref', g.source_ref, 'summary', g.summary,
    'directions', to_jsonb(g.directions), 'evidence', g.evidence, 'retention', g.retention, 'checked_on', g.checked_on,
    'documents', coalesce((select jsonb_agg(jsonb_build_object('title', d.title, 'issuer', d.issuer, 'type', d.doc_type, 'url', d.url, 'note', d.note) order by d.sort)
                           from compliance_documents d where d.item_key = g.item_key), '[]'::jsonb))
  from compliance_guides g where g.item_key = p_key;
$$;
revoke execute on function public._guide_json(text) from public, anon, authenticated;

-- AI agent: official guidance for a checklist item or topic ("sleep", "WWCC", "incidents", "Reg 97").
create or replace function public.agent_guidance(p_key text, p_topic text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_centre uuid := _agent_centre(p_key); v_q text := lower(trim(coalesce(p_topic, '')));
begin
  if v_q = '' then
    return jsonb_build_object('items', (select jsonb_agg(jsonb_build_object('item_key', item_key, 'title', title, 'source_ref', source_ref) order by sort) from compliance_guides),
                              'general_documents', (select jsonb_agg(jsonb_build_object('title', title, 'issuer', issuer, 'url', url, 'note', note) order by sort) from compliance_documents where item_key is null));
  end if;
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(_guide_json(g.item_key) order by g.sort) from compliance_guides g
     where g.item_key = v_q or lower(g.title) like '%' || v_q || '%' or lower(g.source_ref) like '%' || v_q || '%'
        or lower(g.summary) like '%' || v_q || '%' or (v_q like '%wwc%' and g.item_key = 'wwcc')
        or (v_q like '%first aid%' and g.item_key = 'firstaid') or (v_q like '%evacuat%' and g.item_key = 'evacuation')), '[]'::jsonb),
    'note', 'Plain-English guidance from official sources. Not legal advice. Confirm with ACECQA or the NSW Early Learning Commission.');
end $$;
grant execute on function public.agent_guidance(text, text) to anon, authenticated;
""")
    return "\n".join(out) + "\n"


def build_js():
    data = {"checked": CHECKED, "general": GENERAL,
            "guides": [{k: v for k, v in g.items()} for g in GUIDES]}
    return ("// Generated by tools/compliance_library.py. Offline copy of the compliance library\n"
            "// (live mode reads the same content from Supabase).\n"
            "const LIBRARY_DATA = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")


if __name__ == "__main__":
    with open(os.path.join(ROOT, "supabase/migrations/20261026090000_compliance_library.sql"), "w") as f:
        f.write(build_sql())
    with open(os.path.join(ROOT, "beehive-demo/library-data.js"), "w") as f:
        f.write(build_js())
    print("guides:", len(GUIDES), "documents:", len(GENERAL) + sum(len(g["documents"]) for g in GUIDES))
