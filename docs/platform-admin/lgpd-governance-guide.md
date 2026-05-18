# LGPD governance guide

Legal documents use `LegalDocumentVersion` with publish workflow. User acceptance is tracked in `ConsentRecord` (with optional FK to document version).

Data subject requests (`DataSubjectRequest`) support EXPORT, DELETE, and ANONYMIZE workflows managed from the platform admin API.

Retention policies are configured in `DataRetentionPolicy` and monitored from `/platform/lgpd/retention`.

Open Finance bank consents remain in `BankConsent` — separate from legal LGPD consent.
