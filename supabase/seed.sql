-- Seed data for the Alamut Compliance Dashboard.
-- Mirrors `server/seedData.ts` so the database starts populated.
--
-- Run AFTER `0001_init.sql`. Safe to re-run (uses ON CONFLICT).
--
-- Authentication: passwords are NOT seeded here. Populate
-- `team_members.password_hash` (bcrypt) via your provisioning workflow,
-- e.g. `bcrypt.hashSync('newpw', 10)` from Node, before issuing logins.

-- ─── Team members ────────────────────────────────────────────────────────────
-- Two senior personnel hold admin rights:
--   • tom@alamut-im.com    — primary superuser/admin
--   • alice@alamut-im.com  — second admin
insert into public.team_members (id, email, full_name, role, is_active) values
  (1, 'tom@alamut-im.com',          'Tom (Superuser)',    'admin',      true),
  (2, 'alice@alamut-im.com',        'Alice (Admin)',      'admin',      true),
  (3, 'compliance@alamut-im.com',   'Compliance Officer', 'compliance', true),
  (4, 'operations@alamut-im.com',   'Operations Lead',    'operations', true),
  (5, 'finance@alamut-im.com',      'Finance Manager',    'finance',    true),
  (6, 'analyst1@alamut-im.com',     'Analyst One',        'team',       true),
  (7, 'analyst2@alamut-im.com',     'Analyst Two',        'team',       true)
on conflict (email) do nothing;

-- ─── Manual chapters (placeholder structure) ─────────────────────────────────
insert into public.manual_chapters (id, number, title, slug, summary, content, order_index, owner, fca_refs, tags) values
  (1, '1',  'Introduction & Regulatory Status',                     'introduction',           'Firm overview, regulatory permissions and applicability of the manual.', '## 1. Introduction\n\nThis Compliance Manual sets out the policies and procedures of Alamut.', 1,  'Compliance Officer', '{PRIN,SYSC,COND}',           '{overview}'),
  (2, '2',  'Governance & Senior Management Responsibilities',      'governance',             'SMCR governance map, allocation of prescribed responsibilities.',         '## 2. Governance\n\nThe firm operates under SMCR.', 2,  'Senior Admin',       '{SYSC,COCON,APER,FIT}',      '{smcr,governance}'),
  (3, '3',  'Conduct of Business',                                  'conduct-of-business',    'Suitability, best execution, inducements, fair treatment of customers.',  '## 3. Conduct of Business\n\nAll regulated activities follow COBS.', 3, 'Compliance Officer', '{COBS,PRIN}', '{conduct}'),
  (4, '4',  'Market Abuse & Personal Account Dealing',              'market-abuse',           'MAR, insider lists, restricted lists, PA dealing pre-clearance.',         '## 4. Market Abuse\n\nAll staff must comply with MAR and the firm''s restricted list procedure.', 4, 'Compliance Officer', '{MAR,COBS}', '{market-abuse,pa-dealing}'),
  (5, '5',  'Financial Crime, AML & Sanctions',                     'financial-crime',        'AML risk assessment, KYC, sanctions screening, SARs.',                    '## 5. Financial Crime\n\nThe firm prevents money laundering and breach of sanctions.', 5, 'MLRO',               '{FCG,FCTR,SYSC}',            '{aml,sanctions}'),
  (6, '6',  'Conflicts of Interest',                                'conflicts',              'Identification, recording and management of conflicts.',                  '## 6. Conflicts\n\nA conflicts register is reviewed quarterly.', 6, 'Compliance Officer', '{SYSC,COBS}', '{conflicts}'),
  (7, '7',  'Risk Management',                                      'risk-management',        'Risk appetite, ICARA, operational risk, ORSA.',                           '## 7. Risk\n\nThree-lines-of-defence model.', 7, 'Risk Officer',       '{MIFIDPRU,SYSC}',            '{risk,icara}'),
  (8, '8',  'Client Assets (CASS)',                                 'client-assets',          'CASS classification, segregation, reconciliations.',                      '## 8. CASS\n\nClassification reviewed annually.', 8, 'CASS Officer',       '{CASS}',                     '{cass}'),
  (9, '9',  'Regulatory Reporting',                                 'regulatory-reporting',   'RegData returns, MIFIDPRU reporting, transaction reporting, AIFMD Annex IV.','## 9. Regulatory Reporting\n\nSchedule maintained on Compliance Calendar.', 9, 'Compliance Officer', '{SUP,MIFIDPRU,FUND}', '{reporting}'),
  (10,'10', 'Training & Competence',                                'training-competence',    'Annual training plan, attestations, certification.',                      '## 10. Training\n\nMandatory training: COC, AML, MAR, GDPR, OpRes, Cyber.', 10, 'Compliance Officer', '{TC,COCON}', '{training}'),
  (11,'11', 'Operational Resilience & Outsourcing',                 'operational-resilience', 'Important business services, impact tolerances, outsourcing register.',  '## 11. Operational Resilience\n\nReviewed annually.', 11, 'COO',                '{SYSC,CTPS}',               '{op-res,outsourcing}'),
  (12,'12', 'Complaints, Breaches & Whistleblowing',                'complaints-breaches',    'DISP procedures, breach log, whistleblowing channels.',                   '## 12. Complaints & Breaches\n\nMaterial breaches notified to FCA under SUP 15.3.', 12,'Compliance Officer', '{DISP,SUP}', '{complaints,breaches}')
on conflict (slug) do nothing;

-- ─── Compliance obligations ──────────────────────────────────────────────────
insert into public.compliance_obligations (id, title, scope, category, frequency, next_due, fca_refs, owner, status, notes) values
  (1, 'MIFIDPRU Quarterly Return (MIF001-MIF003)', 'firm', 'Regulatory Reporting',   'quarterly',  '2026-05-15', '{MIFIDPRU,SUP}',  'Compliance Officer', 'upcoming',  'Submitted via RegData.'),
  (2, 'AIFMD Annex IV Reporting',                  'fund', 'Regulatory Reporting',   'quarterly',  '2026-05-30', '{FUND,SUP}',      'Operations Lead',    'upcoming',  'Per-fund Annex IV.'),
  (3, 'ICARA Annual Review',                       'firm', 'Prudential',             'annual',     '2026-09-30', '{MIFIDPRU}',      'Risk Officer',       'upcoming',  'Board sign-off.'),
  (4, 'FCA Annual Financial Crime Report',         'firm', 'Financial Crime',        'annual',     '2026-12-31', '{FCG,SUP}',       'MLRO',               'upcoming',  '60 business days post ARD.'),
  (5, 'Annual MLRO Report',                        'firm', 'Financial Crime',        'annual',     '2026-06-30', '{SYSC,FCG}',      'MLRO',               'upcoming',  'Board approval required.'),
  (6, 'Fund NAV Audit Sign-off',                   'fund', 'Audit',                  'annual',     '2026-04-30', '{COLL,FUND}',     'Operations Lead',    'in_progress','Year-end audited statements.'),
  (7, 'SUP 16 RMAR / RegData Half-yearly',         'firm', 'Regulatory Reporting',   'semi_annual','2026-07-30', '{SUP}',           'Finance Manager',    'upcoming',  'FSA001-FSA003.'),
  (8, 'Consumer Duty Annual Board Report',         'firm', 'Conduct',                'annual',     '2026-07-31', '{PRIN,COBS}',     'Senior Admin',       'upcoming',  'Where in scope.'),
  (9, 'Operational Resilience Self-Assessment',    'firm', 'Operational Resilience', 'annual',     '2026-03-31', '{SYSC}',          'COO',                'overdue',   'IBSs and impact tolerances.'),
  (10,'Fund Manager Long Report (UCITS/AIF)',      'fund', 'Reporting',              'annual',     '2026-04-30', '{COLL,FUND}',     'Operations Lead',    'in_progress','Investor-facing report.'),
  (11,'CASS Resolution Pack Review',               'firm', 'Client Assets',          'annual',     '2026-11-30', '{CASS}',          'CASS Officer',       'upcoming',  'Annual refresh.'),
  (12,'SMCR Certification Refresh',                'firm', 'Governance',             'annual',     '2026-10-31', '{SYSC,FIT,COCON}','Compliance Officer', 'upcoming',  'Fit & proper.')
on conflict (id) do nothing;

-- ─── Attestation templates ───────────────────────────────────────────────────
insert into public.attestation_templates (id, topic, category, description, frequency, fca_refs) values
  (1, 'Annual Code of Conduct',         'Code of Conduct',          'Confirm reading and adherence to firm Code of Conduct.', 'annual',    '{COCON,APER}'),
  (2, 'PA Dealing Policy',              'Personal Account Dealing', 'Confirm adherence to PA dealing policy.',                'annual',    '{MAR,COBS}'),
  (3, 'Market Abuse Awareness',         'Market Abuse',             'Annual training and certification.',                     'annual',    '{MAR}'),
  (4, 'AML / Financial Crime Training', 'Financial Crime',          'Annual training and certification.',                     'annual',    '{FCG}'),
  (5, 'Conflicts of Interest Disclosure','Conflicts',               'Quarterly disclosure of new or changed conflicts.',      'quarterly', '{SYSC}'),
  (6, 'Outside Business Interests Refresh','Outside Interests',     'Annual re-confirmation of OBIs.',                        'annual',    '{SYSC,COCON}'),
  (7, 'Information Security & Cyber',   'Op Res',                   'Annual InfoSec / cyber awareness sign-off.',             'annual',    '{SYSC}'),
  (8, 'Gifts & Entertainment Q-Disclosure','Inducements',           'Quarterly G&E register refresh.',                        'quarterly', '{COBS}')
on conflict (id) do nothing;

-- ─── Per-user attestations ───────────────────────────────────────────────────
-- Generate one row per (active user, template) for 2026.
insert into public.attestations (user_id, topic, category, description, due_date, status, fca_refs)
select
  m.id,
  t.topic || ' 2026',
  t.category,
  t.description,
  case t.frequency when 'quarterly' then date '2026-06-30'
                   when 'monthly'   then date '2026-05-31'
                   else                  date '2026-12-31' end,
  'pending',
  t.fca_refs
from public.team_members m
cross join public.attestation_templates t
where m.is_active
on conflict do nothing;
