# Legacy pre-canonical migration evidence

Files `0002` through `0016` in this directory are immutable historical evidence
from the pre-B2.4 workflow. They are deliberately outside the active Drizzle
migration directory and must never be replayed by normal migration tooling.

The active Hybrid Canonical Adoption Point is
`drizzle/0002_canonical_pre_sprint_1.sql`. Fresh databases execute that active
migration after `0000` and `0001`. Existing canonical databases use the guarded
fingerprint adoption flow and record only the canonical `0002` entry.

| Original file | SHA-256 |
|---|---|
| `0002_settings_expand.sql` | `dc75e63102887a98a79700005f895cf253c7e64f1bc55aeb3fcc647d89473745` |
| `0003_website_builder.sql` | `34462698b37e0910a60d63c40473e0313b12f7672ea21cde51565f22f0e65ee9` |
| `0004_website_publishing.sql` | `79a78223f66b0bb92f0d4fd5e9fdc655f07e7b1eb9a964bdfea73c39fb4e84d8` |
| `0005_rls_invoices_integrations.sql` | `bc130bfea689ea2c73169c5abcc593024434e675726b87d96393826a679247b5` |
| `0006_site_domains.sql` | `533efc18654850fc5685743ff95d71c89fd9d7090fd29fa4a66789cb93ace4ac` |
| `0007_domain_verification.sql` | `211a2744cf1d1f8843ac4bda28c418348910a9da87166d92d62e6cfa895016ed` |
| `0008_seo_fields.sql` | `acdf8e257395c615e53713fce5213a809147c18d46fe5cb2b3e1f16ffe459d71` |
| `0009_leads.sql` | `c61cb5ca1fd1b481aedfbe20554e28d72d73a65501830dbe91d7977d97edca51` |
| `0010_crm_pipeline.sql` | `9c60cd7eff71e8107ff2e55f58c6c0211d92af481f4d9b2daeb9d168ba87108e` |
| `0011_reservations.sql` | `b4296fe9afe67f751f5838c73fdb7aca99a54ea773ef7a6f7cdf77ac5aebe868` |
| `0012_property_management.sql` | `7d6f9a268916b63adf6bbdba70cf7b560668275f9110042ca6563870522df760` |
| `0013_housekeeping.sql` | `d23159c08b2fd75bc1e51564edc4b711bc56300909bed5447bdc86a54aeffb5c` |
| `0014_billing.sql` | `b934c1db5cd33ca0be595625db1a9ee03fb12f772466f8414402160a50270994` |
| `0015_billing_actor_attribution.sql` | `bd0ee6e62387740178d7e93d83e1728daf730adad17b20c17397b7c45ab45b4b` |
| `0016_billing_actor_immutability.sql` | `20a21956787573fece5af469ec497dbf74b6f06024ceeb632b8ccc25fa29e15a` |
