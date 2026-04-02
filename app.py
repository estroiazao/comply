# ============================================
#  COMPLY — app.py
#  Comprehensive international tax deadlines
# ============================================

from flask import Flask, jsonify, request, send_from_directory, session, redirect
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3

app = Flask(__name__)
app.secret_key = "comply-secret-key-change-this-later"
CORS(app)

DATABASE = "database.db"


# ── DATABASE ─────────────────────────────────────────────────────────────────


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_feed_table(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS feed_posts (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            score       INTEGER NOT NULL,
            country     TEXT,
            industry    TEXT,
            anonymous   INTEGER DEFAULT 0,
            likes       INTEGER DEFAULT 0,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            email         TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            business_name TEXT,
            country       TEXT,
            region        TEXT,
            industry      TEXT,
            employees     TEXT,
            onboarded     INTEGER DEFAULT 0,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS deadlines (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            title       TEXT NOT NULL,
            month       TEXT,
            day         TEXT,
            due_date    TEXT,
            category    TEXT,
            status      TEXT DEFAULT "upcoming",
            description TEXT,
            penalty     TEXT,
            done        INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    for col in [
        "country TEXT",
        "region TEXT",
        "industry TEXT",
        "employees TEXT",
        "onboarded INTEGER DEFAULT 0",
        "state TEXT",
    ]:
        try:
            conn.execute(f"ALTER TABLE users ADD COLUMN {col}")
        except:
            pass

    # ── Create feed_posts table ──────────────────────────────────────────────
    init_feed_table(conn)

    conn.commit()
    conn.close()


# ── DEADLINE TEMPLATES ────────────────────────────────────────────────────────


def get_deadlines_for(country, region, industry, employees):
    d = []

    # ── UNIVERSAL PAYROLL (all countries with employees) ──────────────────────
    def add_payroll():
        if employees != "solo":
            d.append(
                (
                    "Payroll Tax Q1",
                    "Apr",
                    "30",
                    "2025-04-30",
                    "payroll",
                    "upcoming",
                    "Quarterly payroll tax filing — check your national tax authority",
                    "Penalties vary by country",
                )
            )
            d.append(
                (
                    "Payroll Tax Q2",
                    "Jul",
                    "31",
                    "2025-07-31",
                    "payroll",
                    "upcoming",
                    "Quarterly payroll tax filing — check your national tax authority",
                    "Penalties vary by country",
                )
            )
            d.append(
                (
                    "Payroll Tax Q3",
                    "Oct",
                    "31",
                    "2025-10-31",
                    "payroll",
                    "upcoming",
                    "Quarterly payroll tax filing — check your national tax authority",
                    "Penalties vary by country",
                )
            )
            d.append(
                (
                    "Payroll Tax Q4",
                    "Jan",
                    "31",
                    "2026-01-31",
                    "payroll",
                    "upcoming",
                    "Quarterly payroll tax filing — check your national tax authority",
                    "Penalties vary by country",
                )
            )
            d.append(
                (
                    "Annual Employee Statements",
                    "Jan",
                    "31",
                    "2026-01-31",
                    "payroll",
                    "upcoming",
                    "Issue annual income statements to all employees",
                    "Penalties vary by country",
                )
            )

    # ── UNIVERSAL FOOD INDUSTRY ───────────────────────────────────────────────
    def add_food():
        if industry == "food":
            d.append(
                (
                    "Food Safety / Health Permit Renewal",
                    "Jun",
                    "30",
                    "2025-06-30",
                    "license",
                    "upcoming",
                    "Annual food safety permit — contact your local health authority",
                    "Closure risk if expired",
                )
            )
            d.append(
                (
                    "Food Handler Certification",
                    "Aug",
                    "01",
                    "2025-08-01",
                    "license",
                    "upcoming",
                    "Renew food handler certifications for all staff",
                    "Required by law",
                )
            )

    # ── UNIVERSAL CONSTRUCTION ────────────────────────────────────────────────
    def add_construction():
        if industry == "construction":
            d.append(
                (
                    "Contractor License Renewal",
                    "Jul",
                    "31",
                    "2025-07-31",
                    "license",
                    "upcoming",
                    "Renew contractor/builder license with your national or state authority",
                    "Fines + work stoppage",
                )
            )
            d.append(
                (
                    "Site Insurance Renewal",
                    "Dec",
                    "31",
                    "2025-12-31",
                    "insurance",
                    "upcoming",
                    "Annual construction site and liability insurance renewal",
                    "Loss of coverage",
                )
            )

    # ========================================================================
    #  EUROPE
    # ========================================================================

    if country == "PT":
        d += [
            (
                "IRS — Declaração Anual",
                "Jun",
                "30",
                "2025-06-30",
                "tax",
                "upcoming",
                "Portal das Finanças — irs.gov.pt · Entrega entre Abril e Junho",
                "Coima €200–€2.500",
            ),
            (
                "IVA Trimestral Q1",
                "May",
                "15",
                "2025-05-15",
                "tax",
                "upcoming",
                "Declaração periódica IVA Q1 · Portal AT · at.gov.pt",
                "Coima + juros de mora",
            ),
            (
                "IVA Trimestral Q2",
                "Aug",
                "15",
                "2025-08-15",
                "tax",
                "upcoming",
                "Declaração periódica IVA Q2 · Portal AT · at.gov.pt",
                "Coima + juros de mora",
            ),
            (
                "IVA Trimestral Q3",
                "Nov",
                "15",
                "2025-11-15",
                "tax",
                "upcoming",
                "Declaração periódica IVA Q3 · Portal AT · at.gov.pt",
                "Coima + juros de mora",
            ),
            (
                "IVA Trimestral Q4",
                "Feb",
                "15",
                "2026-02-15",
                "tax",
                "upcoming",
                "Declaração periódica IVA Q4 · Portal AT · at.gov.pt",
                "Coima + juros de mora",
            ),
            (
                "IRC — Pagamento por Conta",
                "Jul",
                "31",
                "2025-07-31",
                "tax",
                "upcoming",
                "Pagamento por conta IRC · Portal das Finanças",
                "Juros compensatórios",
            ),
            (
                "IES — Informação Empresarial",
                "Jun",
                "30",
                "2025-06-30",
                "filing",
                "upcoming",
                "Informação Empresarial Simplificada · Portal das Finanças",
                "Coima €150–€15.000",
            ),
            (
                "Licença de Actividade",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Renovação anual · Câmara Municipal",
                "Multa + encerramento",
            ),
        ]
        if employees != "solo":
            d += [
                (
                    "Segurança Social Mensal",
                    "Jan",
                    "10",
                    "2026-01-10",
                    "payroll",
                    "upcoming",
                    "Declaração mensal de remunerações · Segurança Social Directa",
                    "Coima por atraso",
                ),
                (
                    "Relatório Único",
                    "Mar",
                    "31",
                    "2025-03-31",
                    "filing",
                    "upcoming",
                    "Relatório Único recursos humanos · GEP/MTSSS",
                    "Coima €2.040–€61.200",
                ),
                (
                    "Seguro Acidentes de Trabalho",
                    "Jan",
                    "31",
                    "2026-01-31",
                    "insurance",
                    "upcoming",
                    "Renovação anual obrigatória · Qualquer seguradora",
                    "Invalidade do seguro",
                ),
            ]
        if industry == "food":
            d += [
                (
                    "Licença ASAE Restauração",
                    "Jun",
                    "30",
                    "2025-06-30",
                    "license",
                    "upcoming",
                    "Licença de restauração e bebidas · ASAE",
                    "Coima + encerramento",
                ),
                (
                    "Auditoria HACCP",
                    "Sep",
                    "30",
                    "2025-09-30",
                    "license",
                    "upcoming",
                    "Sistema HACCP obrigatório · Auditoria anual",
                    "Coima + encerramento",
                ),
            ]

    elif country == "ES":
        d += [
            (
                "IRPF — Declaración Anual",
                "Jun",
                "30",
                "2025-06-30",
                "tax",
                "upcoming",
                "Declaración de la Renta · Agencia Tributaria · aeat.es",
                "Recargo 5–20% + intereses",
            ),
            (
                "IVA Trimestral Q1",
                "Apr",
                "20",
                "2025-04-20",
                "tax",
                "urgent",
                "Modelo 303 IVA T1 · Agencia Tributaria",
                "Recargo + intereses",
            ),
            (
                "IVA Trimestral Q2",
                "Jul",
                "20",
                "2025-07-20",
                "tax",
                "upcoming",
                "Modelo 303 IVA T2 · Agencia Tributaria",
                "Recargo + intereses",
            ),
            (
                "IVA Trimestral Q3",
                "Oct",
                "20",
                "2025-10-20",
                "tax",
                "upcoming",
                "Modelo 303 IVA T3 · Agencia Tributaria",
                "Recargo + intereses",
            ),
            (
                "IVA Trimestral Q4",
                "Jan",
                "30",
                "2026-01-30",
                "tax",
                "upcoming",
                "Modelo 303 IVA T4 · Agencia Tributaria",
                "Recargo + intereses",
            ),
            (
                "Impuesto Sociedades",
                "Jul",
                "25",
                "2025-07-25",
                "tax",
                "upcoming",
                "Modelo 200 · Agencia Tributaria · Anual",
                "Sanción 50–150% cuota",
            ),
            (
                "IAE — Licencia Actividad",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Impuesto sobre Actividades Económicas · Ayuntamiento",
                "Multa + cierre",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "FR":
        d += [
            (
                "Déclaration Revenus",
                "May",
                "31",
                "2025-05-31",
                "tax",
                "upcoming",
                "Déclaration annuelle · impots.gouv.fr",
                "Majoration 10–40%",
            ),
            (
                "TVA Trimestrielle Q1",
                "Apr",
                "30",
                "2025-04-30",
                "tax",
                "urgent",
                "Déclaration TVA T1 · impots.gouv.fr",
                "Intérêts de retard 0.2%/mois",
            ),
            (
                "TVA Trimestrielle Q2",
                "Jul",
                "31",
                "2025-07-31",
                "tax",
                "upcoming",
                "Déclaration TVA T2 · impots.gouv.fr",
                "Intérêts de retard 0.2%/mois",
            ),
            (
                "TVA Trimestrielle Q3",
                "Oct",
                "31",
                "2025-10-31",
                "tax",
                "upcoming",
                "Déclaration TVA T3 · impots.gouv.fr",
                "Intérêts de retard 0.2%/mois",
            ),
            (
                "TVA Trimestrielle Q4",
                "Jan",
                "31",
                "2026-01-31",
                "tax",
                "upcoming",
                "Déclaration TVA T4 · impots.gouv.fr",
                "Intérêts de retard 0.2%/mois",
            ),
            (
                "Cotisation Foncière des Entreprises",
                "Dec",
                "15",
                "2025-12-15",
                "tax",
                "upcoming",
                "CFE · Service des Impôts des Entreprises",
                "Majoration 10%",
            ),
            (
                "Licences Commerciales",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Renouvellement annuel · Mairie ou CCI",
                "Amendes + fermeture",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "DE":
        d += [
            (
                "Einkommensteuer",
                "Jul",
                "31",
                "2025-07-31",
                "tax",
                "upcoming",
                "Einkommensteuererklärung · ELSTER · elster.de",
                "Verspätungszuschlag 0.25%/Monat",
            ),
            (
                "Umsatzsteuer Q1",
                "Apr",
                "10",
                "2025-04-10",
                "tax",
                "urgent",
                "USt-Voranmeldung Q1 · ELSTER · elster.de",
                "Verspätungszuschlag + Zinsen",
            ),
            (
                "Umsatzsteuer Q2",
                "Jul",
                "10",
                "2025-07-10",
                "tax",
                "upcoming",
                "USt-Voranmeldung Q2 · ELSTER",
                "Verspätungszuschlag + Zinsen",
            ),
            (
                "Umsatzsteuer Q3",
                "Oct",
                "10",
                "2025-10-10",
                "tax",
                "upcoming",
                "USt-Voranmeldung Q3 · ELSTER",
                "Verspätungszuschlag + Zinsen",
            ),
            (
                "Umsatzsteuer Q4",
                "Jan",
                "10",
                "2026-01-10",
                "tax",
                "upcoming",
                "USt-Voranmeldung Q4 · ELSTER",
                "Verspätungszuschlag + Zinsen",
            ),
            (
                "Körperschaftsteuer",
                "Jul",
                "31",
                "2025-07-31",
                "tax",
                "upcoming",
                "Körperschaftsteuererklärung · ELSTER · Jährlich",
                "Verspätungszuschlag",
            ),
            (
                "Gewerbeanmeldung / Verlängerung",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Gewerbeanmeldung · Gewerbeamt der Gemeinde",
                "Bußgeld bis €1.000",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "IT":
        d += [
            (
                "Dichiarazione dei Redditi",
                "Nov",
                "30",
                "2025-11-30",
                "tax",
                "upcoming",
                "Modello Redditi · Agenzia delle Entrate · agenziaentrate.gov.it",
                "Sanzione 120–240% imposta",
            ),
            (
                "IVA Trimestrale Q1",
                "May",
                "16",
                "2025-05-16",
                "tax",
                "upcoming",
                "Liquidazione IVA T1 · Agenzia delle Entrate",
                "Sanzione 30% + interessi",
            ),
            (
                "IVA Trimestrale Q2",
                "Aug",
                "20",
                "2025-08-20",
                "tax",
                "upcoming",
                "Liquidazione IVA T2 · Agenzia delle Entrate",
                "Sanzione 30% + interessi",
            ),
            (
                "IVA Trimestrale Q3",
                "Nov",
                "16",
                "2025-11-16",
                "tax",
                "upcoming",
                "Liquidazione IVA T3 · Agenzia delle Entrate",
                "Sanzione 30% + interessi",
            ),
            (
                "IRAP — Imposta Regionale",
                "Jun",
                "30",
                "2025-06-30",
                "tax",
                "upcoming",
                "IRAP annuale · Agenzia delle Entrate",
                "Sanzione 30%",
            ),
            (
                "INPS — Contributi Previdenziali",
                "Aug",
                "20",
                "2025-08-20",
                "payroll",
                "upcoming",
                "Contributi INPS trimestrali · inps.it",
                "Sanzione 30% + interessi",
            ),
            (
                "CCIAA — Licenza Attività",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Camera di Commercio · Rinnovo annuale",
                "Multa + chiusura",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "UK":
        d += [
            (
                "Self Assessment Tax Return",
                "Jan",
                "31",
                "2026-01-31",
                "tax",
                "upcoming",
                "HMRC · gov.uk/self-assessment · Online filing",
                "£100 immediate penalty",
            ),
            (
                "VAT Return Q1",
                "May",
                "07",
                "2025-05-07",
                "tax",
                "upcoming",
                "HMRC VAT · Making Tax Digital · gov.uk/vat",
                "Surcharge up to 15%",
            ),
            (
                "VAT Return Q2",
                "Aug",
                "07",
                "2025-08-07",
                "tax",
                "upcoming",
                "HMRC VAT · Making Tax Digital · gov.uk/vat",
                "Surcharge up to 15%",
            ),
            (
                "VAT Return Q3",
                "Nov",
                "07",
                "2025-11-07",
                "tax",
                "upcoming",
                "HMRC VAT · Making Tax Digital · gov.uk/vat",
                "Surcharge up to 15%",
            ),
            (
                "VAT Return Q4",
                "Feb",
                "07",
                "2026-02-07",
                "tax",
                "upcoming",
                "HMRC VAT · Making Tax Digital · gov.uk/vat",
                "Surcharge up to 15%",
            ),
            (
                "Corporation Tax Return",
                "Dec",
                "31",
                "2025-12-31",
                "tax",
                "upcoming",
                "HMRC CT600 · Due 12 months after year end",
                "£100 + daily penalties",
            ),
            (
                "Companies House Annual Return",
                "Apr",
                "30",
                "2025-04-30",
                "filing",
                "upcoming",
                "Confirmation statement · companieshouse.gov.uk · £13 fee",
                "£150 penalty",
            ),
            (
                "Business Rates Payment",
                "Apr",
                "01",
                "2025-04-01",
                "tax",
                "upcoming",
                "Local council · Annually or monthly instalments",
                "Enforcement action",
            ),
        ]
        if employees != "solo":
            d += [
                (
                    "PAYE Monthly to HMRC",
                    "May",
                    "19",
                    "2025-05-19",
                    "payroll",
                    "upcoming",
                    "Employer PAYE · Due 19th each month (22nd if electronic)",
                    "Interest + penalties",
                ),
                (
                    "P60 to Employees",
                    "May",
                    "31",
                    "2025-05-31",
                    "payroll",
                    "upcoming",
                    "Give P60 to all employees by 31 May annually",
                    "Up to £3.000 penalty",
                ),
            ]
        add_food()
        add_construction()

    elif country == "NL":
        d += [
            (
                "Inkomstenbelasting",
                "May",
                "01",
                "2025-05-01",
                "tax",
                "upcoming",
                "Belastingaangifte · belastingdienst.nl · Jaarlijks",
                "Boete 5–100% belasting",
            ),
            (
                "BTW Aangifte Q1",
                "Apr",
                "30",
                "2025-04-30",
                "tax",
                "urgent",
                "BTW-aangifte Q1 · Belastingdienst",
                "Verzuimboete €68",
            ),
            (
                "BTW Aangifte Q2",
                "Jul",
                "31",
                "2025-07-31",
                "tax",
                "upcoming",
                "BTW-aangifte Q2 · Belastingdienst",
                "Verzuimboete €68",
            ),
            (
                "BTW Aangifte Q3",
                "Oct",
                "31",
                "2025-10-31",
                "tax",
                "upcoming",
                "BTW-aangifte Q3 · Belastingdienst",
                "Verzuimboete €68",
            ),
            (
                "BTW Aangifte Q4",
                "Jan",
                "31",
                "2026-01-31",
                "tax",
                "upcoming",
                "BTW-aangifte Q4 · Belastingdienst",
                "Verzuimboete €68",
            ),
            (
                "KvK Jaarrapportage",
                "Dec",
                "31",
                "2025-12-31",
                "filing",
                "upcoming",
                "Jaarrekening deponeren · Kamer van Koophandel · kvk.nl",
                "Boete €900+",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "BE":
        d += [
            (
                "Personenbelasting",
                "Jul",
                "15",
                "2025-07-15",
                "tax",
                "upcoming",
                "Aangifte personenbelasting · MyMinfin · finances.belgium.be",
                "Boete + belastingverhoging",
            ),
            (
                "BTW Aangifte Q1",
                "Apr",
                "20",
                "2025-04-20",
                "tax",
                "urgent",
                "BTW-aangifte Q1 · MyMinfin",
                "Boete + interesten",
            ),
            (
                "BTW Aangifte Q2",
                "Jul",
                "20",
                "2025-07-20",
                "tax",
                "upcoming",
                "BTW-aangifte Q2 · MyMinfin",
                "Boete + interesten",
            ),
            (
                "BTW Aangifte Q3",
                "Oct",
                "20",
                "2025-10-20",
                "tax",
                "upcoming",
                "BTW-aangifte Q3 · MyMinfin",
                "Boete + interesten",
            ),
            (
                "Vennootschapsbelasting",
                "Sep",
                "30",
                "2025-09-30",
                "tax",
                "upcoming",
                "Aangifte vennootschapsbelasting · MyMinfin · Jaarlijks",
                "Boete 10–200%",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "SE":
        d += [
            (
                "Inkomstdeklaration",
                "May",
                "02",
                "2025-05-02",
                "tax",
                "upcoming",
                "Inkomstdeklaration · Skatteverket · skatteverket.se",
                "Förseningsavgift 500–1000 kr",
            ),
            (
                "Moms Q1",
                "May",
                "12",
                "2025-05-12",
                "tax",
                "upcoming",
                "Momsredovisning Q1 · Skatteverket",
                "Förseningsavgift + ränta",
            ),
            (
                "Moms Q2",
                "Aug",
                "12",
                "2025-08-12",
                "tax",
                "upcoming",
                "Momsredovisning Q2 · Skatteverket",
                "Förseningsavgift + ränta",
            ),
            (
                "Moms Q3",
                "Nov",
                "12",
                "2025-11-12",
                "tax",
                "upcoming",
                "Momsredovisning Q3 · Skatteverket",
                "Förseningsavgift + ränta",
            ),
            (
                "Arbetsgivardeklaration",
                "Jan",
                "12",
                "2026-01-12",
                "payroll",
                "upcoming",
                "Arbetsgivardeklaration månadsvis · Skatteverket",
                "Förseningsavgift",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "NO":
        d += [
            (
                "Skattemelding",
                "Apr",
                "30",
                "2025-04-30",
                "tax",
                "urgent",
                "Skattemelding for næringsdrivende · skatteetaten.no",
                "Tvangsmulkt",
            ),
            (
                "MVA Termin 1",
                "Apr",
                "10",
                "2025-04-10",
                "tax",
                "urgent",
                "MVA-melding termin 1 · skatteetaten.no",
                "Tilleggsavgift 20%",
            ),
            (
                "MVA Termin 2",
                "Jun",
                "10",
                "2025-06-10",
                "tax",
                "upcoming",
                "MVA-melding termin 2",
                "Tilleggsavgift 20%",
            ),
            (
                "MVA Termin 3",
                "Aug",
                "31",
                "2025-08-31",
                "tax",
                "upcoming",
                "MVA-melding termin 3",
                "Tilleggsavgift 20%",
            ),
            (
                "MVA Termin 4",
                "Oct",
                "10",
                "2025-10-10",
                "tax",
                "upcoming",
                "MVA-melding termin 4",
                "Tilleggsavgift 20%",
            ),
            (
                "MVA Termin 5",
                "Dec",
                "10",
                "2025-12-10",
                "tax",
                "upcoming",
                "MVA-melding termin 5",
                "Tilleggsavgift 20%",
            ),
            (
                "MVA Termin 6",
                "Feb",
                "10",
                "2026-02-10",
                "tax",
                "upcoming",
                "MVA-melding termin 6",
                "Tilleggsavgift 20%",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "DK":
        d += [
            (
                "Selvangivelse",
                "Jul",
                "01",
                "2025-07-01",
                "tax",
                "upcoming",
                "Selvangivelse · skat.dk · TastSelv Erhverv",
                "Tillæg 200 kr/dag",
            ),
            (
                "Moms Kvartal Q1",
                "May",
                "01",
                "2025-05-01",
                "tax",
                "upcoming",
                "Momsangivelse Q1 · skat.dk",
                "Renter + gebyr",
            ),
            (
                "Moms Kvartal Q2",
                "Aug",
                "01",
                "2025-08-01",
                "tax",
                "upcoming",
                "Momsangivelse Q2 · skat.dk",
                "Renter + gebyr",
            ),
            (
                "Moms Kvartal Q3",
                "Nov",
                "01",
                "2025-11-01",
                "tax",
                "upcoming",
                "Momsangivelse Q3 · skat.dk",
                "Renter + gebyr",
            ),
            (
                "Moms Kvartal Q4",
                "Feb",
                "01",
                "2026-02-01",
                "tax",
                "upcoming",
                "Momsangivelse Q4 · skat.dk",
                "Renter + gebyr",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "FI":
        d += [
            (
                "Veroilmoitus",
                "Apr",
                "30",
                "2025-04-30",
                "tax",
                "urgent",
                "Veroilmoitus · vero.fi · OmaVero",
                "Myöhästymismaksu",
            ),
            (
                "ALV Kausiveroilmoitus Q1",
                "Apr",
                "12",
                "2025-04-12",
                "tax",
                "urgent",
                "ALV-ilmoitus Q1 · vero.fi",
                "Myöhästymismaksu + korot",
            ),
            (
                "ALV Kausiveroilmoitus Q2",
                "Jul",
                "12",
                "2025-07-12",
                "tax",
                "upcoming",
                "ALV-ilmoitus Q2 · vero.fi",
                "Myöhästymismaksu + korot",
            ),
            (
                "ALV Kausiveroilmoitus Q3",
                "Oct",
                "12",
                "2025-10-12",
                "tax",
                "upcoming",
                "ALV-ilmoitus Q3 · vero.fi",
                "Myöhästymismaksu + korot",
            ),
            (
                "ALV Kausiveroilmoitus Q4",
                "Jan",
                "12",
                "2026-01-12",
                "tax",
                "upcoming",
                "ALV-ilmoitus Q4 · vero.fi",
                "Myöhästymismaksu + korot",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "CH":
        d += [
            (
                "Steuererklärung",
                "Mar",
                "31",
                "2025-03-31",
                "tax",
                "upcoming",
                "Steuererklärung · Kantonales Steueramt · estv.admin.ch",
                "Busse + Verzugszinsen",
            ),
            (
                "MWST Abrechnung Q1",
                "Apr",
                "30",
                "2025-04-30",
                "tax",
                "urgent",
                "MWST-Abrechnung Q1 · estv.admin.ch",
                "Verzugszinsen 4%",
            ),
            (
                "MWST Abrechnung Q2",
                "Jul",
                "31",
                "2025-07-31",
                "tax",
                "upcoming",
                "MWST-Abrechnung Q2 · estv.admin.ch",
                "Verzugszinsen 4%",
            ),
            (
                "MWST Abrechnung Q3",
                "Oct",
                "31",
                "2025-10-31",
                "tax",
                "upcoming",
                "MWST-Abrechnung Q3 · estv.admin.ch",
                "Verzugszinsen 4%",
            ),
            (
                "Gewerbebewilligung",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Kantonale Gewerbebewilligung · Jährlich erneuern",
                "Busse + Betriebsschliessung",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "PL":
        d += [
            (
                "PIT — Zeznanie Roczne",
                "Apr",
                "30",
                "2025-04-30",
                "tax",
                "urgent",
                "Zeznanie roczne PIT · e-Urząd Skarbowy · podatki.gov.pl",
                "Kara do 720 stawek dziennych",
            ),
            (
                "VAT-7 Miesięczny",
                "Jan",
                "25",
                "2026-01-25",
                "tax",
                "upcoming",
                "Deklaracja VAT-7 miesięczna · e-Urząd Skarbowy",
                "Odsetki za zwłokę",
            ),
            (
                "CIT — Podatek Dochodowy",
                "Mar",
                "31",
                "2025-03-31",
                "tax",
                "upcoming",
                "Zeznanie CIT-8 · podatki.gov.pl · Rocznie",
                "Kara + odsetki",
            ),
            (
                "ZUS — Składki Społeczne",
                "Jan",
                "20",
                "2026-01-20",
                "payroll",
                "upcoming",
                "ZUS DRA miesięcznie · zus.pl",
                "Odsetki za zwłokę",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "CZ":
        d += [
            (
                "Daňové Přiznání",
                "Apr",
                "01",
                "2025-04-01",
                "tax",
                "urgent",
                "Daňové přiznání k DPFO · mojedane.cz",
                "Penále 20% + úroky",
            ),
            (
                "DPH Přiznání Měsíční",
                "Jan",
                "25",
                "2026-01-25",
                "tax",
                "upcoming",
                "Přiznání k DPH · finanční správa · mfcr.cz",
                "Penále + úroky z prodlení",
            ),
            (
                "Daň z Příjmů Právnických Osob",
                "Apr",
                "01",
                "2025-04-01",
                "tax",
                "upcoming",
                "DPPO přiznání · mojedane.cz · Rocně",
                "Penále 20%",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "AT":
        d += [
            (
                "Einkommensteuererklärung",
                "Jun",
                "30",
                "2025-06-30",
                "tax",
                "upcoming",
                "Einkommensteuererklärung · FinanzOnline · bmf.gv.at",
                "Verspätungszuschlag 10%",
            ),
            (
                "Umsatzsteuervoranmeldung Q1",
                "May",
                "15",
                "2025-05-15",
                "tax",
                "upcoming",
                "UVA Q1 · FinanzOnline",
                "Säumniszuschlag 2%",
            ),
            (
                "Umsatzsteuervoranmeldung Q2",
                "Aug",
                "15",
                "2025-08-15",
                "tax",
                "upcoming",
                "UVA Q2 · FinanzOnline",
                "Säumniszuschlag 2%",
            ),
            (
                "Umsatzsteuervoranmeldung Q3",
                "Nov",
                "15",
                "2025-11-15",
                "tax",
                "upcoming",
                "UVA Q3 · FinanzOnline",
                "Säumniszuschlag 2%",
            ),
            (
                "Gewerbeschein Verlängerung",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Gewerbeberechtigung · Wirtschaftskammer · wko.at",
                "Verwaltungsstrafe",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "GR":
        d += [
            (
                "Δήλωση Φόρου Εισοδήματος",
                "Jun",
                "30",
                "2025-06-30",
                "tax",
                "upcoming",
                "Δήλωση ΦΕ · ΑΑΔΕ · aade.gr",
                "Πρόστιμο 100–500€",
            ),
            (
                "ΦΠΑ Τριμηνιαία Q1",
                "Apr",
                "26",
                "2025-04-26",
                "tax",
                "urgent",
                "Δήλωση ΦΠΑ T1 · myAADE · aade.gr",
                "Πρόστιμο + τόκοι",
            ),
            (
                "ΦΠΑ Τριμηνιαία Q2",
                "Jul",
                "26",
                "2025-07-26",
                "tax",
                "upcoming",
                "Δήλωση ΦΠΑ T2 · myAADE",
                "Πρόστιμο + τόκοι",
            ),
            (
                "ΦΠΑ Τριμηνιαία Q3",
                "Oct",
                "26",
                "2025-10-26",
                "tax",
                "upcoming",
                "Δήλωση ΦΠΑ T3 · myAADE",
                "Πρόστιμο + τόκοι",
            ),
            (
                "Άδεια Λειτουργίας",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Ανανέωση ετήσιας άδειας · Δήμος",
                "Πρόστιμο + αναστολή",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "RO":
        d += [
            (
                "Declaratie Unica",
                "May",
                "25",
                "2025-05-25",
                "tax",
                "upcoming",
                "Declaraţie unică · ANAF · e-Guvernare · anaf.ro",
                "Penalităţi 0.03%/zi",
            ),
            (
                "TVA Lunar",
                "Jan",
                "25",
                "2026-01-25",
                "tax",
                "upcoming",
                "Declaraţie 300 TVA lunar · e-Guvernare ANAF",
                "Penalităţi + dobânzi",
            ),
            (
                "Impozit Profit",
                "Mar",
                "25",
                "2025-03-25",
                "tax",
                "upcoming",
                "Declaraţie 101 impozit pe profit · ANAF",
                "Majorări + penalităţi",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "HU":
        d += [
            (
                "SZJA Bevallás",
                "May",
                "20",
                "2025-05-20",
                "tax",
                "upcoming",
                "Személyi jövedelemadó bevallás · nav.gov.hu",
                "Késedelmi pótlék",
            ),
            (
                "ÁFA Bevallás Q1",
                "Apr",
                "30",
                "2025-04-30",
                "tax",
                "urgent",
                "ÁFA-bevallás Q1 · nav.gov.hu",
                "Mulasztási bírság",
            ),
            (
                "ÁFA Bevallás Q2",
                "Jul",
                "31",
                "2025-07-31",
                "tax",
                "upcoming",
                "ÁFA-bevallás Q2 · nav.gov.hu",
                "Mulasztási bírság",
            ),
            (
                "Iparűzési Adó",
                "May",
                "31",
                "2025-05-31",
                "tax",
                "upcoming",
                "Helyi iparűzési adó · Önkormányzat",
                "Késedelmi pótlék",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    # ========================================================================
    #  AMERICAS
    # ========================================================================

    elif country == "US":
        d += [
            (
                "Q1 Federal Estimated Tax",
                "Apr",
                "15",
                "2025-04-15",
                "tax",
                "urgent",
                "IRS Form 1040-ES · irs.gov/payments",
                "Penalty 0.5%/month",
            ),
            (
                "Q2 Federal Estimated Tax",
                "Jun",
                "16",
                "2025-06-16",
                "tax",
                "upcoming",
                "IRS Form 1040-ES · irs.gov/payments",
                "Penalty 0.5%/month",
            ),
            (
                "Q3 Federal Estimated Tax",
                "Sep",
                "15",
                "2025-09-15",
                "tax",
                "upcoming",
                "IRS Form 1040-ES · irs.gov/payments",
                "Penalty 0.5%/month",
            ),
            (
                "Q4 Federal Estimated Tax",
                "Jan",
                "15",
                "2026-01-15",
                "tax",
                "upcoming",
                "IRS Form 1040-ES · irs.gov/payments",
                "Penalty 0.5%/month",
            ),
            (
                "Annual Federal Tax Return",
                "Apr",
                "15",
                "2025-04-15",
                "filing",
                "urgent",
                "IRS Form 1040 · irs.gov · File or extend by Apr 15",
                "$435 or 5%/month",
            ),
        ]
        if region == "CA":
            d += [
                (
                    "CA Sales Tax Q1",
                    "Apr",
                    "15",
                    "2025-04-15",
                    "tax",
                    "urgent",
                    "CDTFA Form 401-A · cdtfa.ca.gov",
                    "$50 + 10% of tax",
                ),
                (
                    "CA Business License",
                    "Jan",
                    "31",
                    "2026-01-31",
                    "license",
                    "upcoming",
                    "City business license renewal · City website",
                    "$250 fine",
                ),
                (
                    "CA Statement of Information",
                    "Apr",
                    "30",
                    "2025-04-30",
                    "filing",
                    "upcoming",
                    "Secretary of State · bizfile.sos.ca.gov · $20 fee",
                    "$250 late fee",
                ),
            ]
        elif region == "TX":
            d += [
                (
                    "TX Sales & Use Tax",
                    "Apr",
                    "20",
                    "2025-04-20",
                    "tax",
                    "urgent",
                    "Texas Comptroller · comptroller.texas.gov",
                    "5–10% penalty",
                ),
                (
                    "TX Franchise Tax",
                    "May",
                    "15",
                    "2025-05-15",
                    "tax",
                    "upcoming",
                    "Texas Comptroller · Annual",
                    "$50 + 5% penalty",
                ),
            ]
        elif region == "NY":
            d += [
                (
                    "NY Sales Tax Filing",
                    "Mar",
                    "20",
                    "2025-03-20",
                    "tax",
                    "upcoming",
                    "NY Dept of Taxation · tax.ny.gov",
                    "10% penalty + interest",
                ),
                (
                    "NYC General Corp Tax",
                    "Apr",
                    "15",
                    "2025-04-15",
                    "tax",
                    "upcoming",
                    "NYC Finance · Only if operating in NYC",
                    "$100 minimum",
                ),
            ]
        elif region == "FL":
            d += [
                (
                    "FL Sales Tax",
                    "Apr",
                    "19",
                    "2025-04-19",
                    "tax",
                    "urgent",
                    "FL Dept of Revenue · floridarevenue.com",
                    "10% penalty",
                ),
                (
                    "FL Annual Report",
                    "May",
                    "01",
                    "2025-05-01",
                    "filing",
                    "upcoming",
                    "FL Division of Corporations · sunbiz.org · $138.75",
                    "$400 late fee",
                ),
            ]
        else:
            d += [
                (
                    "State Sales Tax",
                    "Apr",
                    "20",
                    "2025-04-20",
                    "tax",
                    "upcoming",
                    "Check your state revenue department website for due dates",
                    "Varies by state",
                ),
                (
                    "Business License Renewal",
                    "Dec",
                    "31",
                    "2025-12-31",
                    "license",
                    "upcoming",
                    "Check your city or county website",
                    "Varies by location",
                ),
            ]
        if employees != "solo":
            d += [
                (
                    "Q1 Payroll Tax Form 941",
                    "Apr",
                    "30",
                    "2025-04-30",
                    "payroll",
                    "upcoming",
                    "IRS Form 941 · EFTPS",
                    "2–15% penalty",
                ),
                (
                    "Q2 Payroll Tax Form 941",
                    "Jul",
                    "31",
                    "2025-07-31",
                    "payroll",
                    "upcoming",
                    "IRS Form 941 · EFTPS",
                    "2–15% penalty",
                ),
                (
                    "Q3 Payroll Tax Form 941",
                    "Oct",
                    "31",
                    "2025-10-31",
                    "payroll",
                    "upcoming",
                    "IRS Form 941 · EFTPS",
                    "2–15% penalty",
                ),
                (
                    "W-2 Forms to Employees",
                    "Jan",
                    "31",
                    "2026-01-31",
                    "payroll",
                    "upcoming",
                    "Send W-2 to all employees by Jan 31",
                    "$50–$280/form",
                ),
            ]
        add_food()
        add_construction()

    elif country == "BR":
        d += [
            (
                "DASN-SIMEI Anual",
                "May",
                "31",
                "2025-05-31",
                "tax",
                "upcoming",
                "Declaração anual MEI · gov.br/mei",
                "Multa R$50 + juros",
            ),
            (
                "DAS Mensal MEI",
                "Jan",
                "20",
                "2026-01-20",
                "tax",
                "upcoming",
                "Documento de Arrecadação Simples · Mensal · gov.br",
                "Multa 2% + juros",
            ),
            (
                "IRPJ — Imposto de Renda PJ",
                "Jul",
                "31",
                "2025-07-31",
                "tax",
                "upcoming",
                "IRPJ anual · Receita Federal · gov.br/receitafederal",
                "Multa 75–150%",
            ),
            (
                "ICMS Mensal",
                "Jan",
                "20",
                "2026-01-20",
                "tax",
                "upcoming",
                "ICMS mensal · Secretaria da Fazenda Estadual",
                "Multa + juros",
            ),
            (
                "Alvará de Funcionamento",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Renovação anual · Prefeitura Municipal",
                "Multa + embargo",
            ),
            (
                "RAIS Anual",
                "Mar",
                "31",
                "2025-03-31",
                "filing",
                "upcoming",
                "Relação Anual de Informações Sociais · MTE",
                "Multa R$425,64",
            ),
        ]
        if employees != "solo":
            d += [
                (
                    "FGTS Mensal",
                    "Jul",
                    "07",
                    "2025-07-07",
                    "payroll",
                    "upcoming",
                    "FGTS · Caixa Econômica Federal · caixa.gov.br",
                    "Multa 10% + juros",
                ),
                (
                    "GPS — INSS Mensal",
                    "Jan",
                    "20",
                    "2026-01-20",
                    "payroll",
                    "upcoming",
                    "Guia da Previdência Social mensal · inss.gov.br",
                    "Multa 2% + juros",
                ),
            ]
        add_food()
        add_construction()

    elif country == "CA":
        d += [
            (
                "T2 Corporate Tax Return",
                "Jun",
                "30",
                "2025-06-30",
                "tax",
                "upcoming",
                "CRA T2 · canada.ca/revenue-agency · 6mo after year end",
                "5% + 1%/month",
            ),
            (
                "GST/HST Return Q1",
                "Apr",
                "30",
                "2025-04-30",
                "tax",
                "urgent",
                "CRA GST/HST · canada.ca/revenue-agency",
                "Interest on balance",
            ),
            (
                "GST/HST Return Q2",
                "Jul",
                "31",
                "2025-07-31",
                "tax",
                "upcoming",
                "CRA GST/HST · canada.ca/revenue-agency",
                "Interest on balance",
            ),
            (
                "GST/HST Return Q3",
                "Oct",
                "31",
                "2025-10-31",
                "tax",
                "upcoming",
                "CRA GST/HST · canada.ca/revenue-agency",
                "Interest on balance",
            ),
            (
                "Business License Renewal",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Municipal business license · Annual renewal",
                "Fines vary",
            ),
            (
                "T4 Slips to Employees",
                "Feb",
                "28",
                "2026-02-28",
                "payroll",
                "upcoming",
                "CRA T4 slips to all employees by Feb 28",
                "$25/day penalty",
            ),
        ]
        if region == "qc":
            d.append(
                (
                    "Quebec Income Tax Return",
                    "Apr",
                    "30",
                    "2025-04-30",
                    "tax",
                    "upcoming",
                    "Revenu Québec · revenuquebec.ca",
                    "5% + 1%/month",
                )
            )
        add_payroll()
        add_food()
        add_construction()

    elif country == "MX":
        d += [
            (
                "Declaración Anual ISR",
                "Mar",
                "31",
                "2025-03-31",
                "tax",
                "upcoming",
                "ISR anual · SAT · sat.gob.mx",
                "Multa 55–75% + recargos",
            ),
            (
                "IVA Mensual",
                "Jan",
                "17",
                "2026-01-17",
                "tax",
                "upcoming",
                "Declaración IVA mensual · SAT · Mi Cuenta SAT",
                "Recargos + multas",
            ),
            (
                "IMSS Patronal Mensual",
                "Jan",
                "17",
                "2026-01-17",
                "payroll",
                "upcoming",
                "Cuotas IMSS · imss.gob.mx · Mensual",
                "Recargos + multas",
            ),
            (
                "Licencia de Funcionamiento",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Renovación anual · Municipio o Alcaldía",
                "Multa + clausura",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "AR":
        d += [
            (
                "Ganancias — DDJJ Anual",
                "Jun",
                "30",
                "2025-06-30",
                "tax",
                "upcoming",
                "Declaración Jurada Ganancias · AFIP · afip.gob.ar",
                "Multa + intereses",
            ),
            (
                "IVA Mensual",
                "Jan",
                "20",
                "2026-01-20",
                "tax",
                "upcoming",
                "Declaración IVA mensual · AFIP · Mis Aplicaciones Web",
                "Multa + intereses",
            ),
            (
                "Ingresos Brutos",
                "Jan",
                "20",
                "2026-01-20",
                "tax",
                "upcoming",
                "Ingresos Brutos mensual · ARBA o DGR Provincial",
                "Multa + intereses",
            ),
            (
                "Habilitación Comercial",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Renovación habilitación · Municipio",
                "Multa + cierre",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "CL":
        d += [
            (
                "Declaración de Renta",
                "Apr",
                "30",
                "2025-04-30",
                "tax",
                "urgent",
                "Operación Renta · SII · sii.cl",
                "Multa 10% impuesto adeudado",
            ),
            (
                "IVA Mensual",
                "Jan",
                "20",
                "2026-01-20",
                "tax",
                "upcoming",
                "Declaración IVA mensual · SII · sii.cl",
                "Multa 10% + intereses",
            ),
            (
                "Patente Municipal",
                "Jun",
                "30",
                "2025-06-30",
                "license",
                "upcoming",
                "Patente comercial semestral · Municipalidad",
                "Multa + clausura",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "CO":
        d += [
            (
                "Declaración de Renta",
                "Aug",
                "15",
                "2025-08-15",
                "tax",
                "upcoming",
                "Declaración renta · DIAN · dian.gov.co",
                "Sanción 10% valor declarado",
            ),
            (
                "IVA Bimestral",
                "Mar",
                "10",
                "2025-03-10",
                "tax",
                "upcoming",
                "Declaración IVA bimestral · DIAN",
                "Sanción + intereses",
            ),
            (
                "Registro Mercantil",
                "Mar",
                "31",
                "2025-03-31",
                "filing",
                "upcoming",
                "Renovación registro mercantil · Cámara de Comercio",
                "Multa + cancelación",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "PE":
        d += [
            (
                "Renta Anual",
                "Mar",
                "31",
                "2025-03-31",
                "tax",
                "upcoming",
                "Declaración Renta anual · SUNAT · sunat.gob.pe",
                "Multa 50% tributo omitido",
            ),
            (
                "IGV Mensual",
                "Jan",
                "20",
                "2026-01-20",
                "tax",
                "upcoming",
                "Declaración IGV mensual · SUNAT",
                "Multa + intereses",
            ),
            (
                "Licencia de Funcionamiento",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Renovación anual · Municipalidad Distrital",
                "Multa + clausura",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    # ========================================================================
    #  ASIA-PACIFIC
    # ========================================================================

    elif country == "AU":
        d += [
            (
                "Income Tax Return",
                "Oct",
                "31",
                "2025-10-31",
                "tax",
                "upcoming",
                "Individual/business tax return · ATO · ato.gov.au",
                "Failure to lodge penalty",
            ),
            (
                "BAS Q1 (Jul-Sep)",
                "Oct",
                "28",
                "2025-10-28",
                "tax",
                "upcoming",
                "Business Activity Statement Q1 · ATO",
                "General interest charge",
            ),
            (
                "BAS Q2 (Oct-Dec)",
                "Feb",
                "28",
                "2026-02-28",
                "tax",
                "upcoming",
                "Business Activity Statement Q2 · ATO",
                "General interest charge",
            ),
            (
                "BAS Q3 (Jan-Mar)",
                "Apr",
                "28",
                "2025-04-28",
                "tax",
                "urgent",
                "Business Activity Statement Q3 · ATO",
                "General interest charge",
            ),
            (
                "BAS Q4 (Apr-Jun)",
                "Jul",
                "28",
                "2025-07-28",
                "tax",
                "upcoming",
                "Business Activity Statement Q4 · ATO",
                "General interest charge",
            ),
            (
                "Business License Renewal",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "State/territory business license · Annual renewal",
                "Fines vary by state",
            ),
        ]
        if employees != "solo":
            d += [
                (
                    "Single Touch Payroll",
                    "Jul",
                    "14",
                    "2025-07-14",
                    "payroll",
                    "upcoming",
                    "STP finalisation · ATO · ato.gov.au/stp",
                    "Penalties apply",
                ),
                (
                    "Superannuation Q1",
                    "Apr",
                    "28",
                    "2025-04-28",
                    "payroll",
                    "upcoming",
                    "Employer super contributions Q1 · 11.5% of salary",
                    "SGC + interest + penalties",
                ),
                (
                    "Superannuation Q2",
                    "Jul",
                    "28",
                    "2025-07-28",
                    "payroll",
                    "upcoming",
                    "Employer super contributions Q2",
                    "SGC + interest + penalties",
                ),
                (
                    "Superannuation Q3",
                    "Oct",
                    "28",
                    "2025-10-28",
                    "payroll",
                    "upcoming",
                    "Employer super contributions Q3",
                    "SGC + interest + penalties",
                ),
                (
                    "Superannuation Q4",
                    "Jan",
                    "28",
                    "2026-01-28",
                    "payroll",
                    "upcoming",
                    "Employer super contributions Q4",
                    "SGC + interest + penalties",
                ),
            ]
        add_food()
        add_construction()

    elif country == "JP":
        d += [
            (
                "確定申告 Kakutei Shinkoku",
                "Mar",
                "17",
                "2025-03-17",
                "tax",
                "upcoming",
                "確定申告 · 国税庁 e-Tax · nta.go.jp",
                "無申告加算税 15–20%",
            ),
            (
                "消費税申告 Consumption Tax",
                "Mar",
                "31",
                "2025-03-31",
                "tax",
                "upcoming",
                "消費税確定申告 · e-Tax · nta.go.jp",
                "延滞税 + 加算税",
            ),
            (
                "法人税 Corporate Tax",
                "May",
                "31",
                "2025-05-31",
                "tax",
                "upcoming",
                "法人税申告 · e-Tax · Annually",
                "延滞税 + 加算税",
            ),
            (
                "固定資産税 Property Tax",
                "May",
                "31",
                "2025-05-31",
                "tax",
                "upcoming",
                "固定資産税 · 市区町村窓口 · Annually",
                "延滞金",
            ),
            (
                "営業許可更新 Business License",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "営業許可更新 · 都道府県または市区町村",
                "罰金 + 営業停止",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "SG":
        d += [
            (
                "Corporate Income Tax",
                "Nov",
                "30",
                "2025-11-30",
                "tax",
                "upcoming",
                "Form C-S/C · IRAS · mytax.iras.gov.sg",
                "5% late penalty + surcharge",
            ),
            (
                "GST F5 Return Q1",
                "Apr",
                "30",
                "2025-04-30",
                "tax",
                "urgent",
                "GST F5 quarterly return · IRAS",
                "5% penalty",
            ),
            (
                "GST F5 Return Q2",
                "Jul",
                "31",
                "2025-07-31",
                "tax",
                "upcoming",
                "GST F5 quarterly return · IRAS",
                "5% penalty",
            ),
            (
                "GST F5 Return Q3",
                "Oct",
                "31",
                "2025-10-31",
                "tax",
                "upcoming",
                "GST F5 quarterly return · IRAS",
                "5% penalty",
            ),
            (
                "Business License Renewal",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "ACRA business registration renewal · bizfile.gov.sg",
                "S$300–S$1,000 fine",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "IN":
        d += [
            (
                "Income Tax Return",
                "Jul",
                "31",
                "2025-07-31",
                "tax",
                "upcoming",
                "ITR filing · Income Tax e-Filing · incometax.gov.in",
                "₹1,000–₹10,000 penalty",
            ),
            (
                "GST Monthly GSTR-3B",
                "Jan",
                "20",
                "2026-01-20",
                "tax",
                "upcoming",
                "GSTR-3B monthly · GST Portal · gst.gov.in",
                "₹50/day late fee",
            ),
            (
                "GST Annual Return GSTR-9",
                "Dec",
                "31",
                "2025-12-31",
                "filing",
                "upcoming",
                "GSTR-9 annual return · gst.gov.in",
                "₹200/day late fee",
            ),
            (
                "TDS Quarterly",
                "Jul",
                "31",
                "2025-07-31",
                "payroll",
                "upcoming",
                "TDS Q1 return Form 24Q/26Q · traces.gov.in",
                "₹200/day penalty",
            ),
            (
                "Shop & Establishment Renewal",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Annual S&E license · State Labour Dept",
                "Fine + closure",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "CN":
        d += [
            (
                "企业所得税 Corporate Income Tax",
                "May",
                "31",
                "2025-05-31",
                "tax",
                "upcoming",
                "企业所得税年度申报 · 国家税务总局 · chinatax.gov.cn",
                "罚款 + 滞纳金",
            ),
            (
                "增值税 VAT Monthly",
                "Jan",
                "15",
                "2026-01-15",
                "tax",
                "upcoming",
                "增值税月度申报 · 电子税务局",
                "滞纳金 0.05%/天",
            ),
            (
                "个人所得税 IIT Monthly",
                "Jan",
                "15",
                "2026-01-15",
                "payroll",
                "upcoming",
                "个人所得税代扣代缴 · 自然人电子税务局",
                "罚款 + 滞纳金",
            ),
            (
                "营业执照年检 Business License",
                "Jun",
                "30",
                "2025-06-30",
                "filing",
                "upcoming",
                "企业年度报告 · 国家企业信用信息公示系统",
                "罚款 + 吊销执照",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "KR":
        d += [
            (
                "종합소득세 Global Income Tax",
                "May",
                "31",
                "2025-05-31",
                "tax",
                "upcoming",
                "종합소득세 확정신고 · 홈택스 · hometax.go.kr",
                "무신고가산세 20%",
            ),
            (
                "부가가치세 VAT Q1",
                "Apr",
                "25",
                "2025-04-25",
                "tax",
                "urgent",
                "부가세 확정신고 Q1 · 홈택스",
                "미납부가산세 + 납부지연",
            ),
            (
                "부가가치세 VAT Q2",
                "Jul",
                "25",
                "2025-07-25",
                "tax",
                "upcoming",
                "부가세 확정신고 Q2 · 홈택스",
                "미납부가산세",
            ),
            (
                "법인세 Corporate Tax",
                "Mar",
                "31",
                "2025-03-31",
                "tax",
                "upcoming",
                "법인세 신고 · 홈택스 · 연간",
                "가산세 20%",
            ),
            (
                "사업자등록 갱신 License",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "사업자 등록 갱신 · 관할 세무서",
                "과태료 + 영업정지",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "ID":
        d += [
            (
                "SPT Tahunan PPh",
                "Apr",
                "30",
                "2025-04-30",
                "tax",
                "urgent",
                "SPT Tahunan PPh Badan · DJP Online · pajak.go.id",
                "Denda Rp1 juta",
            ),
            (
                "SPT Masa PPN",
                "Jan",
                "31",
                "2026-01-31",
                "tax",
                "upcoming",
                "SPT Masa PPN bulanan · DJP Online",
                "Denda Rp500 ribu",
            ),
            (
                "Izin Usaha Renewal",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Perpanjangan NIB/SIUP · OSS · oss.go.id",
                "Denda + pencabutan izin",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "MY":
        d += [
            (
                "Income Tax Form B/C",
                "Jun",
                "30",
                "2025-06-30",
                "tax",
                "upcoming",
                "Income Tax · MyTax · mytax.hasil.gov.my",
                "RM200–RM20,000 penalty",
            ),
            (
                "GST/SST Return",
                "Jan",
                "31",
                "2026-01-31",
                "tax",
                "upcoming",
                "SST-02 bimonthly · MySST · mysst.customs.gov.my",
                "10% late penalty",
            ),
            (
                "Business Premise License",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Renewal at local council (MBPJ/DBKL etc.)",
                "RM500–RM2,000 fine",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "TH":
        d += [
            (
                "ภาษีเงินได้นิติบุคคล Corporate Tax",
                "May",
                "31",
                "2025-05-31",
                "tax",
                "upcoming",
                "ภ.ง.ด.50 · กรมสรรพากร · rd.go.th",
                "เบี้ยปรับ 100–200% ภาษี",
            ),
            (
                "ภาษีมูลค่าเพิ่ม VAT Monthly",
                "Jan",
                "15",
                "2026-01-15",
                "tax",
                "upcoming",
                "ภ.พ.30 รายเดือน · กรมสรรพากร",
                "เบี้ยปรับ + เงินเพิ่ม",
            ),
            (
                "ใบอนุญาตประกอบธุรกิจ",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "ต่ออายุใบอนุญาตประกอบธุรกิจ · สำนักงานเขต",
                "ค่าปรับ + ปิดกิจการ",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "VN":
        d += [
            (
                "Quyết toán thuế TNDN",
                "Mar",
                "31",
                "2025-03-31",
                "tax",
                "upcoming",
                "Quyết toán thuế TNDN · Cục Thuế · thuedientu.gdt.gov.vn",
                "Phạt 10–20% số thuế",
            ),
            (
                "Thuế GTGT hàng tháng",
                "Jan",
                "20",
                "2026-01-20",
                "tax",
                "upcoming",
                "Khai thuế GTGT tháng · Cục Thuế",
                "Phạt 10% tiền thuế",
            ),
            (
                "Giấy phép kinh doanh",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Gia hạn giấy phép · Sở Kế hoạch và Đầu tư",
                "Phạt + đình chỉ",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "NZ":
        d += [
            (
                "Income Tax Return IR3",
                "Jul",
                "07",
                "2025-07-07",
                "tax",
                "upcoming",
                "IR3 return · myIR · ird.govt.nz",
                "Late filing penalty $50–$500",
            ),
            (
                "GST Return Q1",
                "Apr",
                "28",
                "2025-04-28",
                "tax",
                "urgent",
                "GST return · myIR · ird.govt.nz",
                "Late payment penalty 1–4%",
            ),
            (
                "GST Return Q2",
                "Jul",
                "28",
                "2025-07-28",
                "tax",
                "upcoming",
                "GST return · myIR",
                "Late payment penalty",
            ),
            (
                "Business Registration Renewal",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Companies Office renewal · companiesoffice.govt.nz",
                "Removal from register",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    # ========================================================================
    #  MIDDLE EAST & AFRICA
    # ========================================================================

    elif country == "AE":
        d += [
            (
                "Corporate Tax Return",
                "Sep",
                "30",
                "2025-09-30",
                "tax",
                "upcoming",
                "Corporate Tax · EmaraTax · tax.gov.ae · 9% rate",
                "AED 500–20,000 penalty",
            ),
            (
                "VAT Return Q1",
                "Apr",
                "28",
                "2025-04-28",
                "tax",
                "urgent",
                "VAT return Q1 · EmaraTax · tax.gov.ae",
                "AED 1,000 minimum penalty",
            ),
            (
                "VAT Return Q2",
                "Jul",
                "28",
                "2025-07-28",
                "tax",
                "upcoming",
                "VAT return Q2 · EmaraTax",
                "AED 1,000 minimum penalty",
            ),
            (
                "VAT Return Q3",
                "Oct",
                "28",
                "2025-10-28",
                "tax",
                "upcoming",
                "VAT return Q3 · EmaraTax",
                "AED 1,000 minimum penalty",
            ),
            (
                "Trade License Renewal",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Annual trade license · DED or Free Zone authority",
                "AED 250–500 daily fine",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "SA":
        d += [
            (
                "Zakat / Income Tax Return",
                "Jun",
                "30",
                "2025-06-30",
                "tax",
                "upcoming",
                "Zakat/CIT return · ZATCA · zatca.gov.sa",
                "25% surcharge + fines",
            ),
            (
                "VAT Return Q1",
                "Apr",
                "30",
                "2025-04-30",
                "tax",
                "urgent",
                "VAT return Q1 · ZATCA · zatca.gov.sa",
                "SAR 1,000–50,000 fine",
            ),
            (
                "VAT Return Q2",
                "Jul",
                "31",
                "2025-07-31",
                "tax",
                "upcoming",
                "VAT return Q2 · ZATCA",
                "SAR 1,000–50,000 fine",
            ),
            (
                "Commercial Registration Renewal",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "CR renewal · Ministry of Commerce · mc.gov.sa",
                "SAR 5,000 fine",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "ZA":
        d += [
            (
                "Income Tax Return ITR12",
                "Oct",
                "31",
                "2025-10-31",
                "tax",
                "upcoming",
                "ITR12 · SARS · efiling.sars.gov.za",
                "Penalty R250–R16,000",
            ),
            (
                "VAT Return (bimonthly)",
                "Apr",
                "25",
                "2025-04-25",
                "tax",
                "upcoming",
                "VAT201 · SARS e-Filing · bimonthly",
                "10% late penalty",
            ),
            (
                "CIPC Annual Return",
                "Apr",
                "30",
                "2025-04-30",
                "filing",
                "upcoming",
                "Annual return · CIPC · cipc.co.za",
                "Deregistration risk",
            ),
            (
                "UIF Declaration",
                "Jan",
                "31",
                "2026-01-31",
                "payroll",
                "upcoming",
                "UIF monthly declaration · uif.gov.za",
                "Penalties apply",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "NG":
        d += [
            (
                "Company Income Tax",
                "Jun",
                "30",
                "2025-06-30",
                "tax",
                "upcoming",
                "CIT return · FIRS · firs.gov.ng",
                "NGN 25,000 + 25% tax",
            ),
            (
                "VAT Return Monthly",
                "Jan",
                "21",
                "2026-01-21",
                "tax",
                "upcoming",
                "VAT return monthly · FIRS",
                "NGN 50,000 fine",
            ),
            (
                "Business Name Renewal",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "CAC annual return · CAC · cac.gov.ng",
                "Late filing penalty",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "KE":
        d += [
            (
                "Income Tax Return",
                "Jun",
                "30",
                "2025-06-30",
                "tax",
                "upcoming",
                "ITR · KRA · itax.kra.go.ke",
                "KES 2,000 or 5% tax",
            ),
            (
                "VAT Return Monthly",
                "Jan",
                "20",
                "2026-01-20",
                "tax",
                "upcoming",
                "VAT-3 monthly · KRA · iTax",
                "5% of unpaid tax",
            ),
            (
                "Business Permit Renewal",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Annual business permit · County Government",
                "KES 5,000 + closure",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "EG":
        d += [
            (
                "Salary Tax Annual",
                "Mar",
                "31",
                "2025-03-31",
                "tax",
                "upcoming",
                "ضريبة الدخل السنوية · الهيئة العامة للضرائب · eta.gov.eg",
                "غرامة 300–10,000 جنيه",
            ),
            (
                "VAT Monthly",
                "Jan",
                "15",
                "2026-01-15",
                "tax",
                "upcoming",
                "ضريبة القيمة المضافة الشهرية · بوابة الهيئة الضريبية",
                "غرامة + فوائد",
            ),
            (
                "Commercial Registration Renewal",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "تجديد السجل التجاري · وزارة التجارة",
                "غرامة + إغلاق",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    elif country == "MA":
        d += [
            (
                "IS — Impôt sur les Sociétés",
                "Mar",
                "31",
                "2025-03-31",
                "tax",
                "upcoming",
                "IS annuel · Direction Générale des Impôts · tax.gov.ma",
                "Majoration 15%",
            ),
            (
                "TVA Trimestrielle",
                "Apr",
                "30",
                "2025-04-30",
                "tax",
                "urgent",
                "TVA trimestrielle · DGI · tax.gov.ma",
                "Majoration 10% + pénalités",
            ),
            (
                "Patente — Taxe Professionnelle",
                "Jan",
                "31",
                "2026-01-31",
                "license",
                "upcoming",
                "Taxe professionnelle annuelle · Services des impôts",
                "Majoration 15%",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    # ========================================================================
    #  DEFAULT (all other countries)
    # ========================================================================
    else:
        d += [
            (
                "Annual Income / Corporate Tax",
                "Apr",
                "30",
                "2025-04-30",
                "tax",
                "upcoming",
                "File your annual income or corporate tax return with your national tax authority",
                "Penalties vary by country",
            ),
            (
                "VAT / Sales Tax Q1",
                "Apr",
                "20",
                "2025-04-20",
                "tax",
                "upcoming",
                "Quarterly VAT or sales tax filing — check your national tax authority",
                "Penalties vary by country",
            ),
            (
                "VAT / Sales Tax Q2",
                "Jul",
                "20",
                "2025-07-20",
                "tax",
                "upcoming",
                "Quarterly VAT or sales tax filing",
                "Penalties vary by country",
            ),
            (
                "VAT / Sales Tax Q3",
                "Oct",
                "20",
                "2025-10-20",
                "tax",
                "upcoming",
                "Quarterly VAT or sales tax filing",
                "Penalties vary by country",
            ),
            (
                "VAT / Sales Tax Q4",
                "Jan",
                "20",
                "2026-01-20",
                "tax",
                "upcoming",
                "Quarterly VAT or sales tax filing",
                "Penalties vary by country",
            ),
            (
                "Business License Renewal",
                "Dec",
                "31",
                "2025-12-31",
                "license",
                "upcoming",
                "Renew your annual business operating license with your local authority",
                "Fines + closure risk",
            ),
            (
                "Annual Business Report / Filing",
                "Jun",
                "30",
                "2025-06-30",
                "filing",
                "upcoming",
                "Annual business report or company registration renewal",
                "Penalties vary by country",
            ),
        ]
        add_payroll()
        add_food()
        add_construction()

    return d


# ── HELPERS ──────────────────────────────────────────────────────────────────


def row_to_dict(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "month": row["month"],
        "day": row["day"],
        "due_date": row["due_date"],
        "category": row["category"],
        "status": row["status"],
        "description": row["description"],
        "penalty": row["penalty"],
        "done": bool(row["done"]),
    }


def logged_in():
    return "user_id" in session


def current_user_id():
    return session.get("user_id")


# ── PAGES ────────────────────────────────────────────────────────────────────


@app.route("/")
def home():
    if not logged_in():
        return redirect("/login")
    conn = get_db()
    user = conn.execute(
        "SELECT * FROM users WHERE id=?", (current_user_id(),)
    ).fetchone()
    conn.close()
    if not user:
        session.clear()
        return redirect("/login")
    if not user["onboarded"]:
        return redirect("/onboard")
    return send_from_directory("static", "index.html")


@app.route("/landing")
def landing_page():
    return send_from_directory("static", "landing.html")


@app.route("/login")
def login_page():
    return send_from_directory("static", "login.html")


@app.route("/register")
def register_page():
    return send_from_directory("static", "register.html")


@app.route("/onboard")
def onboard_page():
    if not logged_in():
        return redirect("/login")
    return send_from_directory("static", "onboard.html")


@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)


# ── AUTH ─────────────────────────────────────────────────────────────────────


@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    business_name = data.get("business_name", "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    password_hash = generate_password_hash(password)
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (email, password_hash, business_name) VALUES (?, ?, ?)",
            (email, password_hash, business_name),
        )
        conn.commit()
        user = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        session["user_id"] = user["id"]
        session["user_email"] = user["email"]
        session["business_name"] = user["business_name"]
        conn.close()
        return jsonify({"success": True, "redirect": "/onboard"})
    except:
        conn.close()
        return jsonify({"error": "An account with that email already exists."}), 400


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    conn.close()

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Incorrect email or password."}), 401

    session["user_id"] = user["id"]
    session["user_email"] = user["email"]
    session["business_name"] = user["business_name"]
    return jsonify({"success": True, "redirect": "/"})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": True, "redirect": "/login"})


@app.route("/api/me")
def me():
    if not logged_in():
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db()
    user = conn.execute(
        "SELECT * FROM users WHERE id=?", (current_user_id(),)
    ).fetchone()
    conn.close()
    return jsonify(
        {
            "id": current_user_id(),
            "email": session.get("user_email"),
            "business_name": session.get("business_name"),
            "monthly_revenue": user["monthly_revenue"]
            if user and "monthly_revenue" in user.keys()
            else 5000,
        }
    )


# ── ONBOARDING ───────────────────────────────────────────────────────────────


@app.route("/api/onboard", methods=["POST"])
def onboard():
    if not logged_in():
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json()
    country = data.get("country", "OTHER")
    region = data.get("region", "national")
    industry = data.get("industry", "other")
    employees = data.get("employees", "solo")
    monthly_revenue = data.get("monthly_revenue", 5000)
    uid = current_user_id()

    conn = get_db()
    try:
        conn.execute("ALTER TABLE users ADD COLUMN monthly_revenue INTEGER DEFAULT 0")
    except:
        pass

    conn.execute(
        "UPDATE users SET country=?, region=?, industry=?, employees=?, monthly_revenue=?, onboarded=1 WHERE id=?",
        (country, region, industry, employees, monthly_revenue, uid),
    )
    conn.execute("DELETE FROM deadlines WHERE user_id=?", (uid,))

    for item in get_deadlines_for(country, region, industry, employees):
        title, month, day, due_date, category, status, description, penalty = item
        conn.execute(
            """
            INSERT INTO deadlines (user_id,title,month,day,due_date,category,status,description,penalty,done)
            VALUES (?,?,?,?,?,?,?,?,?,0)
        """,
            (uid, title, month, day, due_date, category, status, description, penalty),
        )

    conn.commit()
    conn.close()
    return jsonify({"success": True, "redirect": "/"})


# ── DEADLINES ────────────────────────────────────────────────────────────────


@app.route("/deadlines")
def get_deadlines():
    if not logged_in():
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM deadlines WHERE user_id=? ORDER BY due_date",
        (current_user_id(),),
    ).fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/deadlines/<int:did>/toggle", methods=["PATCH"])
def toggle_done(did):
    if not logged_in():
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM deadlines WHERE id=? AND user_id=?", (did, current_user_id())
    ).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Not found"}), 404
    new_done = 0 if row["done"] else 1
    new_status = "done" if new_done else "upcoming"
    conn.execute(
        "UPDATE deadlines SET done=?, status=? WHERE id=? AND user_id=?",
        (new_done, new_status, did, current_user_id()),
    )
    conn.commit()
    updated = conn.execute("SELECT * FROM deadlines WHERE id=?", (did,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(updated))


@app.route("/deadlines", methods=["POST"])
def add_deadline():
    if not logged_in():
        return jsonify({"error": "Not logged in"}), 401
    data = request.get_json()
    conn = get_db()
    conn.execute(
        """
        INSERT INTO deadlines (user_id,title,month,day,due_date,category,status,description,penalty,done)
        VALUES (?,?,?,?,?,?,"upcoming",?,?,0)
    """,
        (
            current_user_id(),
            data.get("title", "Untitled"),
            data.get("month", ""),
            data.get("day", ""),
            data.get("due_date", ""),
            data.get("category", "filing"),
            data.get("description", ""),
            data.get("penalty", ""),
        ),
    )
    conn.commit()
    new_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    new_row = conn.execute("SELECT * FROM deadlines WHERE id=?", (new_id,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(new_row)), 201


@app.route("/deadlines/<int:did>", methods=["DELETE"])
def delete_deadline(did):
    if not logged_in():
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db()
    conn.execute(
        "DELETE FROM deadlines WHERE id=? AND user_id=?", (did, current_user_id())
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# ── FEED ─────────────────────────────────────────────────────────────────────


@app.route("/api/feed", methods=["GET"])
def get_feed():
    conn = get_db()
    rows = conn.execute("""
        SELECT
            fp.id,
            fp.score,
            fp.country,
            fp.industry,
            fp.anonymous,
            fp.likes,
            fp.created_at,
            CASE WHEN fp.anonymous = 1 THEN 'Anonymous Business'
                 ELSE COALESCE(u.business_name, u.email) END AS display_name
        FROM feed_posts fp
        JOIN users u ON fp.user_id = u.id
        ORDER BY fp.created_at DESC
        LIMIT 50
    """).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/feed/post", methods=["POST"])
def post_to_feed():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    score = data.get("score", 0)
    anonymous = 1 if data.get("anonymous", False) else 0

    conn = get_db()
    user = conn.execute(
        "SELECT country, industry FROM users WHERE id = ?", (session["user_id"],)
    ).fetchone()

    country = user["country"] if user else ""
    industry = user["industry"] if user else ""

    existing = conn.execute(
        """
        SELECT id FROM feed_posts
        WHERE user_id = ? AND DATE(created_at) = DATE('now')
        """,
        (session["user_id"],),
    ).fetchone()

    if existing:
        conn.execute(
            "UPDATE feed_posts SET score = ?, anonymous = ? WHERE id = ?",
            (score, anonymous, existing["id"]),
        )
    else:
        conn.execute(
            "INSERT INTO feed_posts (user_id, score, country, industry, anonymous) VALUES (?, ?, ?, ?, ?)",
            (session["user_id"], score, country, industry, anonymous),
        )

    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/feed/<int:post_id>/like", methods=["PATCH"])
def like_post(post_id):
    conn = get_db()
    conn.execute("UPDATE feed_posts SET likes = likes + 1 WHERE id = ?", (post_id,))
    conn.commit()
    row = conn.execute(
        "SELECT likes FROM feed_posts WHERE id = ?", (post_id,)
    ).fetchone()
    conn.close()
    return jsonify({"likes": row["likes"] if row else 0})


# ── START ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    init_db()
    print("COMPLY is ready!")
    app.run(debug=True)
