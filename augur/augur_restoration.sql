-- ============================================================
-- AUGUR RESTORATION LAYERS - Export
-- Generated: 2026-04-02
-- ============================================================

-- This file documents the restoration physics for each signal.
-- Restoration complexity is the key field for irreversibility.

-- COMPLEXITY KEY:
--   LOW      = Restoration within 6 months, few constraints
--   MEDIUM   = 6-18 months, moderate friction factors
--   HIGH     = 18-36 months, significant constraints
--   EXTREME  = 36+ months, multiple binding constraints
--   IMPOSSIBLE = Restoration not achievable through commercial means


-- ENERGY
-- [EXTREME] Dam failure (hydro)
--   Cost: >$1B | Interruption: $100-500M/day
--   Reconstruction: 24-60 months | Regulatory: 12-36 months
--   Bottleneck: dam_engineering,hydraulic_steel,heavy_haul_logistics
--   Cascade: Energy→Utilities→Agriculture→Real Estate
--   Key Risk: Regulatory redesign after dam failure — most complex permitting in infrastructure
--   Note: Downstream flood damage claims alone can exceed asset value

-- [EXTREME] LNG terminal explosion
--   Cost: >$1B | Interruption: $100-500M/day
--   Reconstruction: 24-48 months | Regulatory: 12-24 months
--   Bottleneck: lng_tanks,regasification_mdvs,engineered_modules
--   Cascade: Energy→Financials→Industrials→Utilities
--   Key Risk: Regulatory moratorium on LNG facility permitting post-incident
--   Note: 3x cost of original construction due to enhanced safety requirements

-- [EXTREME] Platform destruction/sinking
--   Cost: >$1B | Interruption: $50-200M/day
--   Reconstruction: 12-36 months | Regulatory: 6-18 months
--   Bottleneck: offshore_platform_equipment,vessel_availability
--   Cascade: Energy→Financials→Industrials→Utilities
--   Key Risk: Insurance withdrawal during crisis prevents risk transfer
--   Note: Platform destruction: HSE regime redesign + NTSB equivalent inquiry + FID require years

-- [HIGH] Critical infrastructure sabotage
--   Cost: $100-500M | Interruption: $20-100M/day
--   Reconstruction: 3-12 months | Regulatory: 2-8 months
--   Bottleneck: specialized_equipment,security_personnel
--   Cascade: Energy→Financials→Technology
--   Key Risk: State attribution required before restoration can begin
--   Note: Sabotage + war risk = insurance market withdrawal; self-insurance at government scale

-- [HIGH] EU/UK energy sanctions packages
--   Cost: >$1B | Interruption: $50-200M/day
--   Reconstruction: 6-24 months | Regulatory: 6-18 months
--   Bottleneck: alternative_supply_routes
--   Cascade: Energy→Financials→Global Trade
--   Key Risk: EU unanimity requirement means one member state can block reversal
--   Note: Russian oil ban took 6 months to implement; reversal could take longer

-- [HIGH] Facility explosion/fire
--   Cost: $500M-1B | Interruption: $50-200M/day
--   Reconstruction: 6-24 months | Regulatory: 3-12 months
--   Bottleneck: refinery_components,engineers,catastrophe_reinsurers
--   Cascade: Energy→Chemicals→Industrials→Financials
--   Key Risk: Refinery fire triggers OSHA EOP + EPA investigation + state AG — simultaneous constraints
--   Note: Complexity: 6-9 months typical; API/finery rebuilds: 18-24 months

-- [HIGH] OFAC/SDN sanctions on energy entities
--   Cost: >$1B | Interruption: $100-300M/day
--   Reconstruction: 12-36 months | Regulatory: 6-18 months
--   Bottleneck: none_available
--   Cascade: Energy→Financials→Shipping→Technology
--   Key Risk: Delisting from SWIFT requires political reversal, not commercial action
--   Note: OFAC 50% rule — even partial delisting creates 12-month gap before full restoration

-- [HIGH] Pipeline rupture
--   Cost: $100-500M | Interruption: $10-50M/day
--   Reconstruction: 6-18 months | Regulatory: 3-12 months
--   Bottleneck: line_pipe_specifications,heavy_haul, welding_crews
--   Cascade: Energy→Industrials→Chemicals
--   Key Risk: PHMSA investigation halts restart even after physical repair
--   Note: Major trunk lines: 36-48 months for full segment replacement

-- [HIGH] Tanker explosion/sinking
--   Cost: $100-500M | Interruption: $5-20M/day
--   Reconstruction: 3-12 months | Regulatory: 1-6 months
--   Bottleneck: lng_tanker_slots,vessel_construction
--   Cascade: Energy→Shipping→Financials
--   Key Risk: Vessel availability — LR2/Aframax tanker ordering slots book 12+ months out
--   Note: Tanker loss creates classified wreck; salvors may not accept war risk zones

-- [IMPOSSIBLE] IOC asset expropriation
--   Cost: >$1B | Interruption: $500M+/day
--   Reconstruction: N/A - political | Regulatory: N/A - political
--   Bottleneck: none_available
--   Cascade: Energy→Financials→Technology→All sectors
--   Key Risk: Government willing to wait out Western sanctions vs Western companies willing to accept losses
--   Note: Expropriation without compensation is irreversible; restoration = abandoning asset entirely

-- [IMPOSSIBLE] IOC/NOC production cutoff order
--   Cost: >$1B | Interruption: $200-500M/day
--   Reconstruction: N/A - political | Regulatory: N/A - political
--   Bottleneck: none
--   Cascade: Energy→Financials→Global Trade
--   Key Risk: Government decree reversal requires same-level government decision
--   Note: NOC cutoff = nationalized production; restoration = renationalization

-- [IMPOSSIBLE] Wellhead seizure
--   Cost: >$1B | Interruption: $200-500M/day
--   Reconstruction: N/A - political | Regulatory: N/A - political
--   Bottleneck: none_available
--   Cascade: Energy→Financials→Global Trade
--   Key Risk: Wellhead seizure = production loss until political resolution
--   Note: US/EU will not finance restoration under sanctions; operator cannot access site

-- [LOW] OPEC+ production cut announcement
--   Cost: $1-10M | Interruption: $50-200M/day
--   Reconstruction: 0 (policy) | Regulatory: 3-6 months
--   Bottleneck: none
--   Cascade: Energy
--   Key Risk: OPEC+ unanimity rule means any member can block reversal
--   Note: Market restoration within days once quota cut announced; physical restoration instant

-- [MEDIUM] Insurance withdrawal (war risk)
--   Cost: $10-50M | Interruption: $1-10M/day
--   Reconstruction: 1-6 months | Regulatory: 0
--   Bottleneck: none
--   Cascade: Energy→Financials→Shipping
--   Key Risk: War risk insurers withdrawal creates coverage vacuum
--   Note: Withdrawal typically means 30-60 day notice; renewal requires risk improvement

-- [MEDIUM] Lloyd's force majeure declaration
--   Cost: $100-500M | Interruption: $10-50M/day
--   Reconstruction: 1-3 months | Regulatory: 0
--   Bottleneck: none
--   Cascade: Energy→Financials→Shipping
--   Key Risk: War risk insurers exit mid-crisis; cannot force them to return
--   Note: Force majeure invoked; restoration begins when insurance returns

-- [MEDIUM] Pipeline right-of-way revocation
--   Cost: $50-200M | Interruption: $5-20M/day
--   Reconstruction: 3-12 months | Regulatory: 6-24 months
--   Bottleneck: none
--   Cascade: Energy→Industrials
--   Key Risk: Right-of-way disputes with landowners after revocation
--   Note: Easement reinstatement requires environmental review; often easier to route around


-- MATERIALS
-- [EXTREME] Tailings dam failure (TSF)
--   Cost: >$1B | Interruption: $20-100M/day
--   Reconstruction: 24-60 months | Regulatory: 12-36 months
--   Bottleneck: tailings_storage_engineering,heavy_haul,environmental_engineering
--   Cascade: Materials→Energy→Real Estate→Financials
--   Key Risk: Regulatory approval for TSF rebuild requires full environmental impact statement
--   Note: TSF failures: Mount Polley cost $1B+ and took 3 years; environmental remediation dominates cost

-- [HIGH] Chile water rights restriction
--   Cost: $500M-1B | Interruption: $5-20M/day
--   Reconstruction: 6-24 months | Regulatory: 6-12 months
--   Bottleneck: mining_equipment,critical_mineral_processing,water_treatment
--   Cascade: Materials→Industrials→Technology
--   Key Risk: Chile water rights — mining competes with agriculture for scarce water
--   Note: Codelco Chuquicamata: $5.5B expansion took 10 years; water shortage adds 12-24 months

-- [HIGH] Countervailing duty findings
--   Cost: $100-500M | Interruption: $10-50M/day
--   Reconstruction: 6-18 months | Regulatory: 3-12 months
--   Bottleneck: semiconductor_wafers,solar_panels,battery_metals
--   Cascade: Materials→Technology→Industrials
--   Key Risk: Tariffs on critical minerals create strategic stockpiling pressure
--   Note: US Section 232 steel tariffs: 3 years in place; downstream manufacturing cost $2.8B in 2018

-- [HIGH] Indigenous land rights ruling
--   Cost: $100-500M | Interruption: $5-20M/day
--   Reconstruction: 12-36 months | Regulatory: 12-24 months
--   Bottleneck: mining_equipment,heavy_haul,water_treatment
--   Cascade: Materials→Energy→Real Estate
--   Key Risk: Indigenous land rights rulings can take 5-10 years to appeal
--   Note: Pebble Mine (Alaska): 10+ years of permitting, never built; mine not destroyed but never existed

-- [IMPOSSIBLE] Export ban (full)
--   Cost: >$1B | Interruption: $20-100M/day
--   Reconstruction: N/A - political | Regulatory: N/A - political
--   Bottleneck: none
--   Cascade: Materials→Technology→Industrials→Defense
--   Key Risk: Export ban = nationalized resource; restoration requires reversing political decision
--   Note: Indonesian nickel ore ban (2009-2014): 5 years to develop domestic processing

-- [LOW] LME trading halt
--   Cost: $10-50M | Interruption: $1-5M/day
--   Reconstruction: 0-1 months | Regulatory: 0
--   Bottleneck: none
--   Cascade: Materials→Industrials→Financials
--   Key Risk: LME trading halt — resumes next day; no restoration needed for price signal
--   Note: Gold: Comex/LBMA price discovery halt = 0 restoration; physical market unchanged


-- INDUSTRIALS
-- [EXTREME] Critical Mineral Mine Closure (Physical)
--   Cost: $500M-1B | Interruption: $10-50M/day
--   Reconstruction: 24-60 months | Regulatory: 12-36 months
--   Bottleneck: critical_mineral_processing, tailings_storage
--   Cascade: Materials→Energy→Financials
--   Key Risk: Mine closure = local community economic collapse + environmental liability
--   Note: Critical mineral mine closure in remote area: local economy destroyed in days, takes years to remediate

-- [HIGH] Aircraft Airworthiness Directive (AD) — Mass Grounding
--   Cost: $100-500M | Interruption: $10-50M/day
--   Reconstruction: 1-6 months | Regulatory: 1-3 months
--   Bottleneck: type_certificate,engineered_parts,flight_test
--   Cascade: Industrials→Financials
--   Key Risk: Mass grounding = aviation insurance + litigation + passenger uncertainty
--   Note: Max 737 grounding: 20 months; restoration required new software + FAA recertification

-- [HIGH] Factory / Plant Destruction
--   Cost: $100-500M | Interruption: $20-100M/day
--   Reconstruction: 6-24 months | Regulatory: 3-12 months
--   Bottleneck: heavy_equipment,structural_engineering,labor
--   Cascade: Industrials→Financials→Energy
--   Key Risk: OSHA will halt reconstruction until investigation complete
--   Note: Defense contractor facilities add ITAR requirements — restart requires security clearance re-certification

-- [HIGH] ITAR / EAR Violation Findings
--   Cost: $10-50M | Interruption: $1-10M/day
--   Reconstruction: 3-18 months | Regulatory: 3-12 months
--   Bottleneck: defense_articles, cleared_personnel
--   Cascade: Industrials→Technology→Financials
--   Key Risk: ITAR registration suspension — cannot legally export defense articles
--   Note: Company loses revenue stream; foreign customers source from non-US alternatives permanently

-- [HIGH] Port Infrastructure Damage
--   Cost: $500M-1B | Interruption: $100-500M/day
--   Reconstruction: 3-12 months | Regulatory: 1-6 months
--   Bottleneck: port_crane_manufacturing, dredging_capacity
--   Cascade: Industrials→Materials→Energy→Financials
--   Key Risk: Port congestion + insurance withdrawal = ship diversion cascade
--   Note: Container port destruction affects 5-10% of global throughput; 6-9 months for single berth

-- [HIGH] Runway / Airport Damage
--   Cost: $100-500M | Interruption: $10-50M/day
--   Reconstruction: 3-12 months | Regulatory: 1-6 months
--   Bottleneck: aircraft_ground_equipment,runway_surfaces,air_traffic_systems
--   Cascade: Industrials→Financials→Communication Services
--   Key Risk: NTSB equivalent investigation grounds all operations at affected airport
--   Note: Major hub: affects 2-5% of US flight capacity; smaller airports: local economic collapse

-- [HIGH] Suez Canal / Panama Canal Disruption (Physical/Reg)
--   Cost: $50-200M | Interruption: $500M-1B/day
--   Reconstruction: 1-6 weeks | Regulatory: 0
--   Bottleneck: salvage_tugs,heavy_lift_vessels,dredges
--   Cascade: Industrials→Energy→Materials→Financials
--   Key Risk: Canal transit interruption = global shipping rerouting cost
--   Note: Suez Canal blockage (Ever Given): 6 days, ~$10B in trade delay cost; Panama: drought restrictions 2023

-- [IMPOSSIBLE] Nationalization / Expropriation of Industrial Assets
--   Cost: >$1B | Interruption: $100-500M/day
--   Reconstruction: N/A - political | Regulatory: N/A - political
--   Bottleneck: none
--   Cascade: Industrials→Financials→Technology→Energy
--   Key Risk: Government seizure — reversal requires compensation deal + political will
--   Note: Venezuelan nationalization of oil assets: 10+ years of arbitration; assets still not returned

-- [LOW] DoD Supply Chain Emergency Declaration
--   Cost: $1-10M | Interruption: $100-500M/day
--   Reconstruction: 0 (policy) | Regulatory: 0-1 months
--   Bottleneck: none
--   Cascade: Industrials→Materials→Energy→Financials
--   Key Risk: DOD declaration forces supply chain reorientation in days
--   Note: Emergency declaration = commercial contracts subordinated to defense; restoration policy-driven

-- [MEDIUM] Defense Contractor Stock Price / Credit Signal
--   Cost: $100-500M | Interruption: $5-20M/day
--   Reconstruction: 3-12 months | Regulatory: 0
--   Bottleneck: none
--   Cascade: Industrials→Financials
--   Key Risk: Defense contractor stock collapse signals supply chain concern
--   Note: Stock recovers once program is confirmed; restoration = program re-confirmation

-- [MEDIUM] Insurance Withdrawal from Industrial Sites
--   Cost: $1-10M | Interruption: $5-20M/day
--   Reconstruction: 1-6 months | Regulatory: 0
--   Bottleneck: none
--   Cascade: Industrials→Financials→Energy
--   Key Risk: Insurance withdrawal forces facility shutdown regardless of physical condition
--   Note: Withdrawal notice typically 30-90 days; renewal requires risk improvement + premium adjustment


-- CONSUMER DISCRETIONARY
-- [HIGH] Airline fleet grounding (physical)
--   Cost: $100-500M | Interruption: $200-500M/day
--   Reconstruction: 3-12 months | Regulatory: 1-6 months
--   Bottleneck: aircraft_parts,type_certificate,flight_test
--   Cascade: Financials→Industrials→Communication Services
--   Key Risk: Aircraft fleet grounding: NTSB equivalent investigation required
--   Note: Mass grounding like 737 MAX: 20 months; physical destruction grounding: 3-6 months after investigation

-- [HIGH] Cruise ship incident
--   Cost: $100-500M | Interruption: $100-500M/day
--   Reconstruction: 3-12 months | Regulatory: 1-6 months
--   Bottleneck: shipyard_capacity,salvage_crews
--   Cascade: Financials→Industrials
--   Key Risk: Cruise ship incident: regulatory investigation + public confidence
--   Note: COVID cruise ship quarantines: 3-6 months for return to service; physical damage: 6-18 months

-- [HIGH] Mall/property destruction
--   Cost: $500M-1B | Interruption: $10-50M/day
--   Reconstruction: 12-36 months | Regulatory: 6-18 months
--   Bottleneck: reit_capital,commercial_real_estate_debt
--   Cascade: Financials→Industrials→Materials
--   Key Risk: Mall/property destruction: insurance + financing + NIMBY = slow rebuild
--   Note: Shopping center reconstruction: land is there, building is not; 18 months typical

-- [MEDIUM] Auto plant explosion/damage
--   Cost: $100-500M | Interruption: $5-20M/day
--   Reconstruction: 6-18 months | Regulatory: 0-3 months
--   Bottleneck: automotive_stamping,semiconductor_components
--   Cascade: Industrials→Financials→Technology
--   Key Risk: Auto plant physical destruction: substitutes available via other plants
--   Note: OEM has geographic diversification; affected brand loses market share temporarily

-- [MEDIUM] Hotel bombing/damage
--   Cost: $100-500M | Interruption: $50-200M/day
--   Reconstruction: 6-18 months | Regulatory: 3-6 months
--   Bottleneck: hospitality_ff&e,local_labor
--   Cascade: Financials→Industrials
--   Key Risk: Hotel physical damage: substitutes available; market share shifts to survivors
--   Note: Hotel restoration driven by tourism confidence, not physical constraint; 12-18 months for major resort

-- [MEDIUM] Supplier factory destruction
--   Cost: $50-200M | Interruption: $5-20M/day
--   Reconstruction: 3-12 months | Regulatory: 0-3 months
--   Bottleneck: semiconductor_chips,stamping_tools
--   Cascade: Industrials→Technology→Financials
--   Key Risk: Tier-1 supplier destruction cascades to multiple OEMs
--   Note: Single-source components (chips, sensors) can halt entire production lines; 6-9 months for semiconductor短缺


-- CONSUMER STAPLES
-- [EXTREME] Agricultural land contamination
--   Cost: $500M-1B | Interruption: $50-200M/day
--   Reconstruction: 12-36 months | Regulatory: 6-18 months
--   Bottleneck: land_remediation,government_approval
--   Cascade: Agriculture→Real Estate→Financials→Consumer Staples
--   Key Risk: Agricultural land contamination: remediation can take decades
--   Note: Love Canal: 20+ years of remediation before land could be used; agricultural land remediation takes 5-10 years minimum

-- [EXTREME] Livestock disease quarantine
--   Cost: $10-50M | Interruption: $5-20M/day
--   Reconstruction: 12-36 months | Regulatory: 6-12 months
--   Bottleneck: breeding_herd,vaccine,processing
--   Cascade: Agriculture→Consumer Staples→Financials
--   Key Risk: Livestock disease quarantine: entire regional herd must be culled and repopulated
--   Note: Avian Influenza (2022): 50M birds destroyed; egg prices +200%; 6 months to rebuild laying flock

-- [HIGH] Agricultural input export ban
--   Cost: $1-10M | Interruption: $20-100M/day
--   Reconstruction: 0_policy_reversal | Regulatory: 3-12 months
--   Bottleneck: none
--   Cascade: Consumer Staples→Energy→Financials
--   Key Risk: Agricultural input export ban: Russia urea/Potash — affects global food production
--   Note: Russia invasion of Ukraine: fertilizer exports blocked; food production impact 12-18 months later

-- [HIGH] Meatpacking plant closure
--   Cost: $50-200M | Interruption: $10-50M/day
--   Reconstruction: 12-24 months | Regulatory: 3-6 months
--   Bottleneck: breeding_stock,processing_capacity
--   Cascade: Consumer Staples→Agriculture→Financials
--   Key Risk: Meatpacking closure: herd repopulation takes 12-24 months for full restoration
--   Note: African Swine Fever: 40% of Chinese hogs lost; took 3 years to rebuild breeding stock

-- [HIGH] Rationing announcement
--   Cost: $10-50M | Interruption: $100-500M/day
--   Reconstruction: 0_policy_reversal | Regulatory: 1-6 months
--   Bottleneck: none
--   Cascade: Consumer Staples→Financials
--   Key Risk: Rationing announcement: policy reversal restores markets; no physical restoration needed
--   Note: Egypt rice rationing: 2008; reversal within months; but consumer behavior changes persist

-- [MEDIUM] Crop field destruction
--   Cost: $100-500M | Interruption: $20-100M/day
--   Reconstruction: 3-24 months | Regulatory: 0
--   Bottleneck: seed,fertilizer,labor
--   Cascade: Consumer Staples→Energy→Financials
--   Key Risk: Crop field destruction: seasonal constraint — miss the window, that year is gone
--   Note: Hurricane damage to crops before harvest: that year's production simply lost; 6-18 months to next harvest

-- [MEDIUM] Fertilizer import restriction
--   Cost: $1-10M | Interruption: $10-50M/day
--   Reconstruction: 1-6 months | Regulatory: 0
--   Bottleneck: vessel_space,fertilizer_production
--   Cascade: Consumer Staples→Energy→Industrials
--   Key Risk: Fertilizer import restriction: alternative sources available but take time
--   Note: US fertilizer imports from Russia/Morocco: alternative sourcing 3-6 months; price spike immediate

-- [MEDIUM] Food export ban
--   Cost: $1-10M | Interruption: $50-200M/day
--   Reconstruction: 0_policy_reversal | Regulatory: 3-12 months
--   Bottleneck: none
--   Cascade: Consumer Staples→Agriculture→Financials
--   Key Risk: Food export ban: reversal requires same-level political decision
--   Note: India wheat export ban (2022): announced suddenly; reversal timeline uncertain; affects global markets immediately

-- [MEDIUM] Food processing plant destruction
--   Cost: $100-500M | Interruption: $20-100M/day
--   Reconstruction: 6-18 months | Regulatory: 0-3 months
--   Bottleneck: food_processing_equipment,labor
--   Cascade: Consumer Staples→Financials→Agriculture
--   Key Risk: Food processing plant destruction: physical rebuild; biological production continues
--   Note: Processing facility vs biological constraint: facility rebuilds in 6-18 months; biological production uninterrupted

-- [MEDIUM] Grain elevator destruction
--   Cost: $50-200M | Interruption: $5-20M/day
--   Reconstruction: 6-12 months | Regulatory: 0
--   Bottleneck: grain_elevator_equipment,rail_capacity
--   Cascade: Consumer Staples→Agriculture→Industrials
--   Key Risk: Grain elevator destruction near harvest = that year's crop handling capacity lost
--   Note: Storage capacity loss at harvest = permanent loss of that year's production; restoration = next harvest

-- [MEDIUM] Port grain elevator destruction
--   Cost: $50-200M | Interruption: $10-50M/day
--   Reconstruction: 3-12 months | Regulatory: 0-3 months
--   Bottleneck: refrigeration_equipment,industrial_power
--   Cascade: Consumer Staples→Agriculture→Energy
--   Key Risk: Port grain elevator: concentrated export infrastructure; limited alternatives
--   Note: US Gulf grain export: 60% of global grain trade through limited terminals; alternatives take years


-- HEALTH CARE
-- [EXTREME] Hospital bombing / facility attack
--   Cost: >$1B | Interruption: $100-500M/day
--   Reconstruction: 12-36 months | Regulatory: 12-24 months
--   Bottleneck: bioreactors,cleanrooms,fda_inspectors,unique_cell_lines
--   Cascade: Health Care→Financials→Technology
--   Key Risk: FDA facility approval for new biologic manufacturing: 12-24 months minimum
--   Note: Biologics manufacturing is not fungible: losing a cell line is losing irreplaceable IP

-- [HIGH] API supply embargo
--   Cost: $50-200M | Interruption: $10-50M/day
--   Reconstruction: 3-12 months | Regulatory: 1-6 months
--   Bottleneck: api_supply_chain,chemical_precursors
--   Cascade: Health Care→Financials→Chemicals
--   Key Risk: API supply embargo: India/China API supply to US disrupted
--   Note: China API imports: 90%+ of US penicillin V, ibuprofen, acetaminophen; alternatives 12-18 months

-- [HIGH] Nuclear/radiation incident (radiopharma)
--   Cost: $50-200M | Interruption: $20-100M/day
--   Reconstruction: 12-36 months | Regulatory: 12-24 months
--   Bottleneck: medical_isotopes,radiopharmaceutical_production,regulatory_approval
--   Cascade: Health Care→Financials→Technology
--   Key Risk: Nuclear incident at radiopharma facility: NRC licensing + environmental review
--   Note: Technetium-99m: 80% of US medical imaging depends on 6 reactors; most past service life

-- [HIGH] Pharma facility explosion/fire
--   Cost: $500M-1B | Interruption: $50-200M/day
--   Reconstruction: 12-24 months | Regulatory: 12-18 months
--   Bottleneck: api_manufacturing,quality_testing,fda_inspection
--   Cascade: Health Care→Financials
--   Key Risk: FDA drug approval for new manufacturing source: 12+ months
--   Note: Abbreviated New Drug Application (ANDA): 12-18 months for new generic manufacturer approval

-- [HIGH] WTO TRIPS waiver invocation
--   Cost: $500M-1B | Interruption: $100-500M/day
--   Reconstruction: 6-18 months | Regulatory: 3-12 months
--   Bottleneck: vaccine_manufacturing,glass_vials,syringes,cold_chain
--   Cascade: Health Care→Financials→Industrials→Technology
--   Key Risk: WHO pandemic declaration: global supply chain competition for medical supplies
--   Note: COVID vaccine production: 12 months to first doses; full global coverage: 3+ years

-- [IMPOSSIBLE] Clinical trial halts
--   Cost: $100-500M | Interruption: $1-5M/day
--   Reconstruction: N/A | Regulatory: N/A
--   Bottleneck: unique_clinical_data,patient_samples
--   Cascade: Health Care→Technology→Financials
--   Key Risk: Clinical trial halt: years of data lost; cannot re-run Phase III trials
--   Note: Trial participants may have progressed disease; cannot re-enroll same patients

-- [IMPOSSIBLE] Lab destruction (BSL-3/4 breach or physical)
--   Cost: $100-500M | Interruption: $20-100M/day
--   Reconstruction: N/A | Regulatory: N/A
--   Bottleneck: bsl4_labs,viral_stocks,specialist_personnel
--   Cascade: Health Care→Financials→Technology
--   Key Risk: BSL-4 lab breach: irreplaceable biological materials may be destroyed
--   Note: Unique viral isolates: decades to collect; cannot be reconstructed from nothing

-- [MEDIUM] Blood bank failure / contamination
--   Cost: $10-50M | Interruption: $5-20M/day
--   Reconstruction: 3-12 months | Regulatory: 0-3 months
--   Bottleneck: blood_donors,testing_kits,cold_chain
--   Cascade: Health Care→Financials
--   Key Risk: Blood bank failure: requires rebuilding donor network + testing infrastructure
--   Note: AABB: blood supply is perishable; disruption manifests within days; restoration 1-3 months

-- [MEDIUM] Good Manufacturing Practice (GMP) warning letters / import alerts
--   Cost: $1-10M | Interruption: $1-10M/day
--   Reconstruction: 3-12 months | Regulatory: 3-12 months
--   Bottleneck: fda_inspection_capacity,manufacturing_upgrades
--   Cascade: Health Care→Financials
--   Key Risk: FDA import alert: foreign facility barred from US import
--   Note: Warning letter/import alert resolution: 6-12 months; facility must demonstrate compliance

-- [MEDIUM] Insurance coverage mandate changes
--   Cost: $100-500M | Interruption: $50-200M/day
--   Reconstruction: 3-12 months | Regulatory: 3-12 months
--   Bottleneck: none
--   Cascade: Health Care→Financials→Technology
--   Key Risk: CMS coverage determination: policy reversal restores reimbursement
--   Note: CMS national coverage determination: 9-12 months typically; can be expedited in emergencies


-- FINANCIALS
-- [HIGH] Bank license revocations
--   Cost: $500M-1B | Interruption: $100-500M/day
--   Reconstruction: 3-12 months | Regulatory: 0
--   Bottleneck: none
--   Cascade: Financials→Real Estate→Industrials
--   Key Risk: Bank license revocation: institution ceases to exist; restoration via acquisition
--   Note: FDIC receivership: institution is gone; restoration = acquisition by competitor

-- [HIGH] Credit rating downgrade to default/D
--   Cost: >$1B | Interruption: $500M-1B/day
--   Reconstruction: 6-18 months | Regulatory: 0
--   Bottleneck: none
--   Cascade: Financials→Real Estate→Industrials
--   Key Risk: Credit rating downgrade to default: refinancing costs spike; entity may not survive
--   Note: Investment grade to junk crossover: typical 3-5 year recovery to pre-downgrade spreads

-- [HIGH] Deposit freeze/holiday (institutional)
--   Cost: $1-10M | Interruption: $100-500M/day systemic
--   Reconstruction: 0-1 months | Regulatory: 0
--   Bottleneck: none
--   Cascade: Financials→Technology→Consumer Discretionary
--   Key Risk: Deposit freeze halt: liquidity injection + FDIC guarantee + communication strategy
--   Note: SVB: 48 hours from social media run to FDIC takeover; digital speed makes this near-impossible to stop

-- [HIGH] Trading floor damage
--   Cost: $500M-1B | Interruption: $1B+/day systemic
--   Reconstruction: 1-6 months | Regulatory: 0-1 months
--   Bottleneck: trading_floor_rebuild,connectivity
--   Cascade: Financials→All Sectors
--   Key Risk: Trading floor destruction: markets must halt; electronic trading provides partial backup
--   Note: NYSE floor destruction: trading would halt; electronic matching continues but price discovery impaired

-- [IMPOSSIBLE] Capital controls imposed
--   Cost: >$1B | Interruption: $100-500M/day
--   Reconstruction: N/A - political | Regulatory: N/A - political
--   Bottleneck: none
--   Cascade: Financials→All Sectors
--   Key Risk: Capital controls: government intervention; reversal requires same-level authority
--   Note: Cyprus bail-in (2013): deposits >100K haircut; reversal of capital controls took 2+ years

-- [IMPOSSIBLE] Data center failures (targeted)
--   Cost: >$1B | Interruption: $1B+/day systemic
--   Reconstruction: N/A - systemic | Regulatory: N/A - systemic
--   Bottleneck: none
--   Cascade: Financials→All Sectors
--   Key Risk: Data center destruction: payments collapse; digital trust infrastructure gone
--   Note: No physical equivalent: a destroyed payment data center destroys trust in the payment system itself

-- [IMPOSSIBLE] SWIFT restrictions
--   Cost: >$1B | Interruption: $1B+/day systemic
--   Reconstruction: N/A - political | Regulatory: N/A - political
--   Bottleneck: none
--   Cascade: Financials→All Sectors
--   Key Risk: SWIFT restriction: removal from global payment system is near-irreversible
--   Note: Iran's SWIFT disconnection (2018): still disconnected 6+ years later; only political reversal restores

-- [MEDIUM] Correspondent banking frozen
--   Cost: $100-500M | Interruption: $1-5M/day
--   Reconstruction: 1-6 months | Regulatory: 0
--   Bottleneck: none
--   Cascade: Financials→All Sectors
--   Key Risk: Correspondent banking frozen: USD clearing stops; resolution via alternative correspondent
--   Note: Danske Bank Estonia: correspondent banks withdrew; still couldn't find replacement for 18 months


-- INFORMATION TECHNOLOGY
-- [EXTREME] Equipment damage
--   Cost: $500M-1B | Interruption: $500M-1B/day
--   Reconstruction: 12-24 months | Regulatory: 0-3 months
--   Bottleneck: ASML_EUV,Applied_Materials_tools,lead_times_18_months
--   Cascade: Technology→Industrials→Financials
--   Key Risk: EUV machine damage: ASML is sole supplier; 18+ month lead times
--   Note: ASML EUV: only one company in the world can make these machines; no substitute possible

-- [EXTREME] Fab facility damage
--   Cost: >$1B | Interruption: $1B+/day
--   Reconstruction: 18-36 months | Regulatory: 6-12 months
--   Bottleneck: ASML_EUV,CoWoS_packaging,TSMC_N3N5_wafers
--   Cascade: Technology→Industrials→Financials→Consumer Discretionary
--   Key Risk: Fab facility damage: EUV machine lead time is the binding constraint (18-36 months)
--   Note: TSMC N3/N5 capacity: 12-24 month lead times for new wafers; losing a fab = losing years of advanced node output

-- [HIGH] Data center destruction
--   Cost: $500M-1B | Interruption: $500M-1B/day
--   Reconstruction: 3-12 months | Regulatory: 1-6 months
--   Bottleneck: power_infrastructure,cooling_systems,fiber_routes
--   Cascade: Technology→Financials→Communication Services
--   Key Risk: Data center destruction: backup exists but restore takes months
--   Note: Hyperscale data centers: 100MW facilities; rebuilding takes 12-18 months; economic cost dominates

-- [HIGH] Fab contamination event
--   Cost: $100-500M | Interruption: $100-500M/day
--   Reconstruction: 1-6 months | Regulatory: 0-3 months
--   Bottleneck: wafer_replacements,contamination_source_identification
--   Cascade: Technology→Industrials→Financials
--   Key Risk: Fab contamination: yields drop; investigation halts production temporarily
--   Note: Contamination events: 4-8 weeks to identify source; 6-12 weeks to clean and restart

-- [HIGH] Subsea cable cut
--   Cost: $100-500M | Interruption: $100-500M/day
--   Reconstruction: 3-12 months | Regulatory: 1-6 months
--   Bottleneck: cable_repair_vessels,undersea_route_permits
--   Cascade: Communication Services→Financials→Industrials
--   Key Risk: Subsea cable cut: repair ships limited; multiple jurisdictions for permits
--   Note: 500+ cables globally; repair vessel fleet <10 ships; major route repair: 3-6 months

-- [IMPOSSIBLE] BIS Entity List additions
--   Cost: $1-10M | Interruption: $500M-1B/day
--   Reconstruction: N/A - political | Regulatory: N/A - political
--   Bottleneck: none
--   Cascade: Technology→Industrials→Financials
--   Key Risk: BIS Entity List addition: removal requires political reversal
--   Note: Huawei added to Entity List (2019): still restricted 6+ years later; no commercial path to removal

-- [IMPOSSIBLE] IP licensing revocations
--   Cost: $1-10M | Interruption: $100-500M/day
--   Reconstruction: N/A - political/technical | Regulatory: N/A - political/technical
--   Bottleneck: none
--   Cascade: Technology→Industrials→Financials
--   Key Risk: ARM license revocation: Chinese chip designers lose instruction set architecture
--   Note: ARMv9 license lost: Chinese fabs cannot manufacture chips using latest ARM ISA; no equivalent alternative

-- [IMPOSSIBLE] Netherlands ASML export license denials
--   Cost: $1-10M | Interruption: $100-500M/day
--   Reconstruction: N/A - political | Regulatory: N/A - political
--   Bottleneck: none
--   Cascade: Technology→Industrials→Financials
--   Key Risk: ASML EUV export denial: Dutch government decision; reversal requires same-level approval
--   Note: China EUV: denied since 2019; ASML holds 100% market share; no alternative


-- COMMUNICATION SERVICES
-- [EXTREME] T1-007
--   Cost: >$1B | Interruption: $500M-1B/day
--   Reconstruction: 18-36 months | Regulatory: 6-12 months
--   Bottleneck: satellite_manufacturing,launch_vehicles,launch_pad_access
--   Cascade: Communication Services→Financials→Technology→Defense
--   Key Risk: Satellite destruction: replacement satellites take 18-36 months to build + launch
--   Note: LEO constellations (Starlink): can replenish faster; GEO satellites: 3-5 years for replacement

-- [HIGH] T1-008
--   Cost: $100-500M | Interruption: $100-500M/day
--   Reconstruction: 3-12 months | Regulatory: 1-6 months
--   Bottleneck: power_infrastructure,cooling,physical_security
--   Cascade: Communication Services→Technology→Financials
--   Key Risk: IXP/data center damage: internet exchange points have limited redundancy
--   Note: IXP destruction: BGP routing shifts to alternatives; internet performance degraded for millions

-- [HIGH] T1-008
--   Cost: $500M-1B | Interruption: $500M-1B/day
--   Reconstruction: 6-18 months | Regulatory: 3-12 months
--   Bottleneck: hyperscale_construction,power_utility_upgrades,fiber_routes
--   Cascade: Technology→Financials→Communication Services
--   Key Risk: Data center seizure/destruction: hyperscale facilities are 100MW+; no quick fix
--   Note: Hyperscale DC: $1B+ construction cost; 18-24 months to rebuild; regional internet degraded

-- [HIGH] T1-010
--   Cost: $100-500M | Interruption: $100-500M/day
--   Reconstruction: 3-12 months | Regulatory: 1-6 months
--   Bottleneck: cable_repair_ships,marine_permits,landing_rights
--   Cascade: Communication Services→Financials→Industrials→Technology
--   Key Risk: Undersea cable cut: global repair vessel fleet <10 ships; permit coordination complex
--   Note: 500+ active undersea cables; ~8 repair ships globally; major route repair: 3-6 months

-- [HIGH] T2-013
--   Cost: $10-50M | Interruption: $50-200M/day
--   Reconstruction: 3-12 months | Regulatory: 6-18 months
--   Bottleneck: local_infrastructure,data_centre_requirements
--   Cascade: Communication Services→Technology→Financials
--   Key Risk: Data localization mandate: requires building local infrastructure to store data domestically
--   Note: Russia data localization (2015): compliance took 2-3 years for major tech companies; ongoing enforcement gaps

-- [HIGH] T2-014
--   Cost: $100-500M | Interruption: $100-500M/day
--   Reconstruction: 3-12 months | Regulatory: 1-6 months
--   Bottleneck: cdn_replacement,local_content_storage
--   Cascade: Communication Services→Technology→Financials
--   Key Risk: CDN seizure: content delivery infrastructure replacement required
--   Note: CDN is concentrated (Akamai, Cloudflare, Fastly); seizure of one would cascade to thousands of sites

-- [LOW] T1-012
--   Cost: $1-10M | Interruption: $10-50M/day
--   Reconstruction: 0-1 months | Regulatory: 0
--   Bottleneck: none (countermeasures exist)
--   Cascade: Communication Services→Defense
--   Key Risk: Cellular jamming: reversible once jamming stops; equipment intact
--   Note: Jamming is typically temporary; no physical restoration needed once interference ends

-- [MEDIUM] T1-001
--   Cost: $50-200M | Interruption: $10-50M/day
--   Reconstruction: 3-9 months | Regulatory: 0-3 months
--   Bottleneck: tower_structure,RF_equipment,labor
--   Cascade: Communication Services→Financials→Industrials
--   Key Risk: Cell tower destruction: substitutes via other towers + small cells
--   Note: Wireless networks have redundancy; single tower loss = degraded service not outage

-- [MEDIUM] T2-001
--   Cost: $0 | Interruption: $100-500M/day
--   Reconstruction: 0 (policy) | Regulatory: 1-6 months
--   Bottleneck: none
--   Cascade: Communication Services→Financials→Technology
--   Key Risk: Internet shutdown: government order; reversal restores immediately
--   Note: India internet shutdowns: sometimes reversed within days; sometimes last months; depends on political situation


-- REAL ESTATE
-- [HIGH] DOI takeover of private insurer
--   Cost: $500M-1B | Interruption: $10-50M/day
--   Reconstruction: 12-36 months | Regulatory: 6-12 months
--   Bottleneck: none
--   Cascade: Real Estate→Financials
--   Key Risk: DOI takeover: major insurer failure → policy transfer to state guaranty fund
--   Note: Major insurer failure: 12-18 months of policy transfer; guaranty fund coverage limits leave gaps

-- [HIGH] Emergency DOI order
--   Cost: $1-10M | Interruption: $100-500M/day systemic
--   Reconstruction: 0-1 months | Regulatory: 0
--   Bottleneck: none
--   Cascade: Real Estate→Financials
--   Key Risk: Emergency DOI order: regulator forces coverage continuation; temporary fix
--   Note: Suspension of cancellations buys time but doesn't solve underlying insolvency; temporary band-aid

-- [HIGH] Non-renewal notices
--   Cost: $1-10M | Interruption: $1-5M/day
--   Reconstruction: 0 | Regulatory: 0
--   Bottleneck: none
--   Cascade: Real Estate→Financials→Consumer Discretionary
--   Key Risk: Non-renewal cascade: 10%+ policies non-renewed = coverage gaps cascade to property values
--   Note: Non-renewal at scale: property values collapse (can't get mortgages without insurance); cascading effects over 12-24 months

-- [IMPOSSIBLE] Catastrophic loss year
--   Cost: >$1B | Interruption: $1B+/day systemic
--   Reconstruction: N/A - market | Regulatory: N/A - market
--   Bottleneck: none
--   Cascade: Real Estate→Financials→Industrials→Consumer Discretionary
--   Key Risk: Catastrophic loss year: insurance market collapse cascades to all property owners
--   Note: PCS >$100B loss year (Katrina, Harvey, Ian): insurance market withdrawal in affected regions; 3-5 years for capacity to return

-- [IMPOSSIBLE] No coverage at any price
--   Cost: $0 direct | Interruption: $50-200M/day systemic
--   Reconstruction: N/A - market failure | Regulatory: N/A - market failure
--   Bottleneck: none
--   Cascade: Real Estate→Financials→Consumer Discretionary→Industrials
--   Key Risk: No coverage at any price: insurance market has failed; government backstop required
--   Note: If private insurance exits completely: only federal flood insurance (NFIP) or state funds remain; market failure state

-- [LOW] Rate filing spike
--   Cost: $10-50M | Interruption: $5-20M/day
--   Reconstruction: 0-3 months | Regulatory: 3-12 months
--   Bottleneck: none
--   Cascade: Real Estate→Financials
--   Key Risk: Rate filing spike: insurers pass through losses via pricing; policyholders face sticker shock
--   Note: 25%+ rate increases: policyholders forced to self-insure or abandon properties; 6-12 months for regulatory approval

-- [LOW] Zoning change proposal / comprehensive plan amendment
--   Cost: $1-10M | Interruption: $1-5M/day
--   Reconstruction: 3-12 months | Regulatory: 3-12 months
--   Bottleneck: none
--   Cascade: Real Estate→Industrials→Consumer Discretionary
--   Key Risk: Zoning changes: political process; NIMBY vs development advocates
--   Note: Zoning changes affect property values but restoration is just the process; no physical restoration needed

-- [MEDIUM] Climate risk disclosure requirements (SEC climate rule)
--   Cost: $10-50M | Interruption: $5-20M/day
--   Reconstruction: 6-18 months | Regulatory: 0
--   Bottleneck: none
--   Cascade: Real Estate→Financials→Industrials
--   Key Risk: SEC climate disclosure: forces market to price physical risk; values reprice downward
--   Note: SEC climate rule implementation: properties with physical risk get marked down; cascading through CRE values

-- [MEDIUM] Reserve strengthening
--   Cost: $100-500M | Interruption: $1-5M/day
--   Reconstruction: 0 | Regulatory: 0
--   Bottleneck: none
--   Cascade: Real Estate→Financials
--   Key Risk: Reserve strengthening: insurer capital consumed by losses; writing new business constrained
--   Note: Top 10 insurers adding $10B+ reserves: capital constraint for 1-2 years; new business pricing increases