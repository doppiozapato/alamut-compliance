// Canonical reference list of FCA Handbook modules.
// Source: https://handbook.fca.org.uk/handbook
// All URLs link directly to the relevant module on the FCA site.

import type { FcaModule } from "../shared/schema";

const HB = "https://handbook.fca.org.uk/handbook";

export const FCA_MODULES: FcaModule[] = [
  // High Level Standards
  { code: "PRIN", title: "Principles for Businesses", category: "High Level Standards", url: `${HB}/PRIN`, description: "Fundamental obligations under the regulatory system." },
  { code: "SYSC", title: "Senior Management Arrangements, Systems and Controls", category: "High Level Standards", url: `${HB}/SYSC`, description: "Governance, risk management and internal control requirements." },
  { code: "COCON", title: "Code of Conduct", category: "High Level Standards", url: `${HB}/COCON`, description: "Conduct rules for individuals." },
  { code: "COND", title: "Threshold Conditions", category: "High Level Standards", url: `${HB}/COND`, description: "Minimum conditions for authorisation." },
  { code: "APER", title: "Statements of Principle and Code of Practice for Approved Persons", category: "High Level Standards", url: `${HB}/APER` },
  { code: "FIT", title: "The Fit and Proper test for Employees and Senior Personnel", category: "High Level Standards", url: `${HB}/FIT` },
  { code: "FINMAR", title: "Financial Stability and Market Confidence", category: "High Level Standards", url: `${HB}/FINMAR` },
  { code: "TC", title: "Training and Competence", category: "High Level Standards", url: `${HB}/TC` },
  { code: "GEN", title: "General Provisions", category: "High Level Standards", url: `${HB}/GEN` },
  { code: "FEES", title: "Fees Manual", category: "High Level Standards", url: `${HB}/FEES` },

  // Prudential Standards
  { code: "GENPRU", title: "General Prudential sourcebook", category: "Prudential Standards", url: `${HB}/GENPRU` },
  { code: "INSPRU", title: "Prudential sourcebook for Insurers", category: "Prudential Standards", url: `${HB}/INSPRU` },
  { code: "MIFIDPRU", title: "Prudential sourcebook for MiFID Investment Firms", category: "Prudential Standards", url: `${HB}/MIFIDPRU` },
  { code: "MIPRU", title: "Prudential sourcebook for Mortgage and Home Finance Firms, and Insurance Intermediaries", category: "Prudential Standards", url: `${HB}/MIPRU` },
  { code: "IPRU-FSOC", title: "Interim Prudential sourcebook for Friendly Societies", category: "Prudential Standards", url: `${HB}/IPRU-FSOC` },
  { code: "IPRU-INS", title: "Interim Prudential sourcebook for Insurers", category: "Prudential Standards", url: `${HB}/IPRU-INS` },
  { code: "IPRU-INV", title: "Interim Prudential sourcebook for Investment Businesses", category: "Prudential Standards", url: `${HB}/IPRU-INV` },

  // Business Standards
  { code: "COBS", title: "Conduct of Business sourcebook", category: "Business Standards", url: `${HB}/COBS`, description: "Conduct of business rules for investment business." },
  { code: "ICOBS", title: "Insurance: Conduct of Business sourcebook", category: "Business Standards", url: `${HB}/ICOBS` },
  { code: "MCOB", title: "Mortgages and Home Finance: Conduct of Business sourcebook", category: "Business Standards", url: `${HB}/MCOB` },
  { code: "BCOBS", title: "Banking: Conduct of Business sourcebook", category: "Business Standards", url: `${HB}/BCOBS` },
  { code: "CMCOB", title: "Claims Management: Conduct of Business sourcebook", category: "Business Standards", url: `${HB}/CMCOB` },
  { code: "FPCOB", title: "Funeral Plan: Conduct of Business sourcebook", category: "Business Standards", url: `${HB}/FPCOB` },
  { code: "PDCOB", title: "Pensions Dashboards Conduct of Business sourcebook", category: "Business Standards", url: `${HB}/PDCOB` },
  { code: "CASS", title: "Client Assets sourcebook", category: "Business Standards", url: `${HB}/CASS`, description: "Client money and asset rules." },
  { code: "MAR", title: "Market Conduct", category: "Business Standards", url: `${HB}/MAR`, description: "Market abuse and conduct of trading venues." },
  { code: "PROD", title: "Product Intervention and Product Governance sourcebook", category: "Business Standards", url: `${HB}/PROD` },
  { code: "ESG", title: "Environmental, Social and Governance sourcebook", category: "Business Standards", url: `${HB}/ESG`, description: "Sustainability disclosure and labelling rules." },

  // Regulatory Processes
  { code: "SUP", title: "Supervision", category: "Regulatory Processes", url: `${HB}/SUP`, description: "Regulatory reporting and supervisory relationship." },
  { code: "DEPP", title: "Decision Procedure and Penalties Manual", category: "Regulatory Processes", url: `${HB}/DEPP` },

  // Redress
  { code: "DISP", title: "Dispute Resolution: Complaints", category: "Redress", url: `${HB}/DISP` },
  { code: "CONRED", title: "Consumer Redress Schemes sourcebook", category: "Redress", url: `${HB}/CONRED` },
  { code: "COMP", title: "Compensation", category: "Redress", url: `${HB}/COMP` },

  // Specialist sourcebooks
  { code: "ATCS", title: "Authorised Travel Compensation Scheme", category: "Specialist sourcebooks", url: `${HB}/ATCS` },
  { code: "COLL", title: "Collective Investment Schemes", category: "Specialist sourcebooks", url: `${HB}/COLL`, description: "Authorised funds (UCITS, NURS, QIS) regulation." },
  { code: "CREDS", title: "Credit Unions sourcebook", category: "Specialist sourcebooks", url: `${HB}/CREDS` },
  { code: "CONC", title: "Consumer Credit sourcebook", category: "Specialist sourcebooks", url: `${HB}/CONC` },
  { code: "CTPS", title: "Critical Third Parties sourcebook", category: "Specialist sourcebooks", url: `${HB}/CTPS` },
  { code: "FUND", title: "Investment Funds sourcebook", category: "Specialist sourcebooks", url: `${HB}/FUND`, description: "AIFM rules and unauthorised AIFs." },
  { code: "PROF", title: "Professional Firms", category: "Specialist sourcebooks", url: `${HB}/PROF` },
  { code: "RCB", title: "Regulated Covered Bonds sourcebook", category: "Specialist sourcebooks", url: `${HB}/RCB` },
  { code: "SECN", title: "Securitisation sourcebook", category: "Specialist sourcebooks", url: `${HB}/SECN` },
  { code: "REC", title: "Recognised Investment Exchanges", category: "Specialist sourcebooks", url: `${HB}/REC` },
  { code: "EMIRR", title: "EMIR Reporting sourcebook", category: "Specialist sourcebooks", url: `${HB}/EMIRR` },

  // Listing, Prospectus and Disclosure
  { code: "UKLR", title: "UK Listing Rules sourcebook", category: "Listing, Prospectus and Disclosure", url: `${HB}/UKLR` },
  { code: "PRM", title: "Prospectus Rules", category: "Listing, Prospectus and Disclosure", url: `${HB}/PRM` },
  { code: "DTR", title: "Disclosure Guidance and Transparency Rules", category: "Listing, Prospectus and Disclosure", url: `${HB}/DTR` },
  { code: "DISC", title: "Disclosure sourcebook", category: "Listing, Prospectus and Disclosure", url: `${HB}/DISC` },

  // Handbook Guides
  { code: "EMPS", title: "Energy Market Participants", category: "Handbook Guides", url: `${HB}/EMPS` },
  { code: "OMPS", title: "Oil Market Participants", category: "Handbook Guides", url: `${HB}/OMPS` },
  { code: "SERV", title: "Service Companies", category: "Handbook Guides", url: `${HB}/SERV` },
  { code: "BENCH", title: "Benchmarks", category: "Handbook Guides", url: `${HB}/BENCH` },
  { code: "BFSAG", title: "Banking and Financial Services (Authorised Persons) Guide", category: "Handbook Guides", url: `${HB}/BFSAG` },

  // Regulatory and Registry Guides
  { code: "COLLG", title: "Collective Investment Schemes Guide", category: "Regulatory and Registry Guides", url: `${HB}/COLLG` },
  { code: "ENFG", title: "Enforcement Guide", category: "Regulatory and Registry Guides", url: `${HB}/ENFG` },
  { code: "FCG", title: "Financial Crime Guide", category: "Regulatory and Registry Guides", url: `${HB}/FCG`, description: "FCA guidance on financial crime systems and controls." },
  { code: "FCTR", title: "Financial Crime Thematic Reviews", category: "Regulatory and Registry Guides", url: `${HB}/FCTR` },
  { code: "PERG", title: "Perimeter Guidance Manual", category: "Regulatory and Registry Guides", url: `${HB}/PERG` },
  { code: "RFCCBS", title: "The Responsibilities of Providers and Distributors for the Fair Treatment of Customers", category: "Regulatory and Registry Guides", url: `${HB}/RFCCBS` },
  { code: "RPPD", title: "Recognised Persons Public Database", category: "Regulatory and Registry Guides", url: `${HB}/RPPD` },
  { code: "UNFCOG", title: "Unfair Contract Terms Regulatory Guide", category: "Regulatory and Registry Guides", url: `${HB}/UNFCOG` },
  { code: "WDPG", title: "Wind-Down Planning Guide", category: "Regulatory and Registry Guides", url: `${HB}/WDPG` },
  { code: "M2G", title: "Approach to Mutuals", category: "Regulatory and Registry Guides", url: `${HB}/M2G` },

  // Glossary
  { code: "Glossary", title: "Handbook Glossary", category: "Glossary", url: `${HB}/glossary`, description: "Definitions of all defined terms used in the Handbook." },
];

export const FCA_CATEGORIES = Array.from(
  new Set(FCA_MODULES.map((m) => m.category)),
);
