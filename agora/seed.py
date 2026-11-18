"""Demo data for Agora: fictional businesses across Segovia, inside and outside the centre."""
import json, random
from . import db

BUSINESSES = [
    ("hola@lamuralla.es", "Bar La Muralla", "bar", "centro", "Calle Real 14",
     "Bar La Muralla is a bar in the historic centre, two minutes from the aqueduct. Known for tortilla and vermouth.",
     "Bar La Muralla es un bar en el casco historico, a dos minutos del acueducto. Conocido por su tortilla y su vermut.",
     ["drinks", "tapas", "evening"], 1),
    ("info@casadelcordon.es", "Casa del Cordon", "restaurant", "centro", "Plaza Mayor 3",
     "A family restaurant on Plaza Mayor with a daily menu built for students.",
     "Restaurante familiar en la Plaza Mayor con un menu diario pensado para estudiantes.",
     ["lunch", "dinner", "student menu"], 1),
    ("hola@cafeazoguejo.es", "Cafe Azoguejo", "cafe", "centro", "Plaza del Azoguejo 7",
     "Coffee, wifi and long tables. The cafe students actually study in.",
     "Cafe, wifi y mesas largas. La cafeteria donde los estudiantes de verdad estudian.",
     ["coffee", "study", "breakfast"], 1),
    ("contacto@elfogon.es", "El Fogon de Nueva", "restaurant", "nueva", "Av. Juan Carlos I 22",
     "Neighbourhood kitchen in Nueva Segovia, ten minutes from the centre and half the price.",
     "Cocina de barrio en Nueva Segovia, a diez minutos del centro y a mitad de precio.",
     ["lunch", "neighbourhood"], 0),
    ("hola@padelsegovia.es", "Padel Segovia", "sport", "zorrilla", "Calle Jose Zorrilla 101",
     "Four indoor courts, racket rental included for students.",
     "Cuatro pistas cubiertas, alquiler de pala incluido para estudiantes.",
     ["sport", "padel"], 1),
    ("teatro@juanbravo.es", "Teatro Juan Bravo", "culture", "centro", "Plaza Mayor 6",
     "The city theatre, with a block of seats reserved for students at every show.",
     "El teatro de la ciudad, con un bloque de butacas reservado a estudiantes en cada funcion.",
     ["culture", "theatre"], 1),
    ("hola@libreriaintramuros.es", "Libreria Intramuros", "shop", "centro", "Calle Juan Bravo 40",
     "Bookshop and stationery, with second-hand textbooks every September.",
     "Libreria y papeleria, con libros de texto de segunda mano cada septiembre.",
     ["books", "retail"], 0),
    ("hola@lavanderiasanlorenzo.es", "Lavanderia San Lorenzo", "shop", "sanlo", "Calle San Lorenzo 8",
     "Wash and fold by the bag, ready the same evening.",
     "Lavado y doblado por bolsa, listo la misma tarde.",
     ["laundry", "services"], 0),
]

OFFERS = [
    (0, "table", "Empty table - 35% off, Mon-Thu 18:00-20:30", "Mesa libre - 35% de descuento, Mon-Thu 18:00-20:30",
     "Quiet hours at Bar La Muralla. Limited seats.", "Horas tranquilas en Bar La Muralla. Plazas limitadas.",
     900, 585, 20, "Mon-Thu 18:00-20:30"),
    (0, "star", "Tortilla + Cana - 25% for students", "Tortilla + Cana - 25% para estudiantes",
     "Our star product at a student price.", "Nuestro producto estrella a precio de estudiante.",
     700, 525, 0, ""),
    (1, "menu", "Student menu - starter, main, drink", "Menu estudiante - primero, segundo, bebida",
     "A full menu priced for students, every weekday.", "Menu completo a precio de estudiante, de lunes a viernes.",
     1400, 950, 0, ""),
    (2, "discount", "20% off every coffee and pastry", "20% en todo cafe y bolleria",
     "Valid with a verified university email.", "Valido con correo universitario verificado.",
     350, 280, 0, ""),
    (3, "menu", "Neighbourhood menu - 30% for students", "Menu de barrio - 30% para estudiantes",
     "Ten minutes from the centre, half the price.", "A diez minutos del centro, a mitad de precio.",
     1300, 910, 0, ""),
    (4, "table", "Off-peak court - 30% off, Mon-Thu 16:00-19:00", "Pista valle - 30% de descuento, Mon-Thu 16:00-19:00",
     "Court and rackets for four players.", "Pista y palas para cuatro jugadores.",
     1600, 1120, 12, "Mon-Thu 16:00-19:00"),
    (6, "star", "Second-hand textbooks - 40% for students", "Libros de texto usados - 40% para estudiantes",
     "Bring last year's books, take this year's.", "Trae los libros del ano pasado, llevate los de este.",
     2500, 1500, 30, ""),
    (7, "star", "Wash and fold, one bag", "Lavado y doblado, una bolsa",
     "Drop it before 11:00, collect it at 18:00.", "Dejala antes de las 11:00, recogela a las 18:00.",
     1100, 800, 0, ""),
]

EVENTS = [
    (0, "party", "Student night at Bar La Muralla", "Noche estudiante en Bar La Muralla",
     "Two drinks and music until late.", "Dos consumiciones y musica hasta tarde.", 3, 1000, 500, 80, 1),
    (5, "theatre", "Student seats - 'La vida es sueno'", "Butacas estudiante - 'La vida es sueno'",
     "Classic Spanish theatre, surtitles in English.", "Teatro clasico espanol, sobretitulos en ingles.",
     5, 1800, 900, 40, 1),
    (4, "sport_play", "Open padel tournament", "Torneo abierto de padel",
     "Pairs, three rounds, racket included.", "Parejas, tres rondas, pala incluida.", 6, 1600, 900, 24, 0),
    (2, "concert", "Acoustic session at Cafe Azoguejo", "Sesion acustica en Cafe Azoguejo",
     "Local bands, Thursday evening.", "Bandas locales, jueves por la tarde.", 2, 1200, 600, 50, 0),
    (1, "tour", "Walking tour: Segovia after dark", "Ruta: Segovia de noche",
     "Ninety minutes, in Spanish and English.", "Noventa minutos, en espanol e ingles.", 4, 1500, 700, 30, 0),
    (5, "sport_watch", "Gimnastica Segoviana - match screening", "Gimnastica Segoviana - partido en pantalla",
     "The away game on the big screen.", "El partido fuera de casa en pantalla grande.", 7, 800, 400, 60, 0),
]

JOBS = [
    (0, "job", "Bar staff, weekends", "Personal de barra, fines de semana",
     "Friday and Saturday evenings. No experience needed.", "Viernes y sabado por la tarde. Sin experiencia.",
     10.0, 950, "Fri-Sat 20:00-01:00"),
    (1, "job", "Waiter, lunch service", "Camarero/a, servicio de comidas",
     "Monday to Friday lunch. Spanish not required.", "De lunes a viernes al mediodia. No se requiere espanol.",
     15.0, 900, "Mon-Fri 13:00-16:00"),
    (2, "job", "Barista, mornings", "Barista, mananas",
     "Early shift, training given.", "Turno de manana, con formacion.", 12.0, 950, "Mon-Fri 08:00-12:00"),
    (6, "job", "Shop assistant, Saturdays", "Dependiente/a, sabados",
     "Books and stationery.", "Libros y papeleria.", 8.0, 950, "Sat 10:00-14:00, 17:00-20:00"),
    (4, "job", "Court attendant", "Monitor de pista",
     "Afternoons, flexible around classes.", "Tardes, flexible con las clases.", 10.0, 1000, "Afternoons"),
]

STUDENT_TUTORING = [
    ("Statistics", 1500, "Weekday evenings"),
    ("Spanish for Erasmus", 1200, "Tue and Thu"),
    ("Calculus I", 1500, "Weekends"),
]

STUDENTS = [
    ("marta.ruiz@student.ie.edu", "Marta Ruiz", "en"),
    ("liam.oconnor@student.ie.edu", "Liam O'Connor", "en"),
    ("sofia.martin@uva.es", "Sofia Martin", "es"),
]


def _evening(ts):
    """Pin demo events to 20:00 local time so the listing reads like a real agenda."""
    import time as _t
    lt = _t.localtime(ts)
    return int(_t.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday, 20, 0, 0, 0, 0, -1)))


def wipe():
    conn = db.connect()
    for t in ("applications", "transactions", "jobs", "events", "offers",
              "assistant_state", "sessions", "verifications", "businesses", "students"):
        conn.execute("DELETE FROM %s" % t)
    conn.commit(); conn.close()


def run():
    db.init()
    wipe()
    now = db.now()
    bids = []
    for email, name, cat, zone, addr, den, des, tags, premium in BUSINESSES:
        bid = db.run(
            "INSERT INTO businesses(email,name,category,zone,address,description_en,description_es,"
            "tags,premium,profile_complete,verified,created_at) VALUES(?,?,?,?,?,?,?,?,?,1,1,?)",
            (email, name, cat, zone, addr, den, des, json.dumps(tags), premium, now))
        bids.append(bid)
        db.run("INSERT OR IGNORE INTO assistant_state(business_id) VALUES(?)", (bid,))

    for bi, kind, ten, tes, den, des, lc, sc, stock, win in OFFERS:
        db.run("INSERT INTO offers(business_id,kind,title_en,title_es,detail_en,detail_es,list_cents,"
               "student_cents,stock,claimed,window_label,active,created_at) VALUES(?,?,?,?,?,?,?,?,?,0,?,1,?)",
               (bids[bi], kind, ten, tes, den, des, lc, sc, stock, win, now))

    for bi, cat, ten, tes, den, des, days, lc, sc, cap, feat in EVENTS:
        db.run("INSERT INTO events(business_id,category,title_en,title_es,detail_en,detail_es,starts_at,"
               "venue,list_cents,student_cents,capacity,sold,featured,active,created_at) "
               "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)",
               (bids[bi], cat, ten, tes, den, des, _evening(now + days * 86400),
                BUSINESSES[bi][1], lc, sc, cap, random.randint(2, max(3, cap // 4)), feat, now))

    for bi, kind, ten, tes, den, des, hrs, pay, sched in JOBS:
        db.run("INSERT INTO jobs(business_id,kind,title_en,title_es,detail_en,detail_es,hours_per_week,"
               "pay_cents,schedule,active,created_at) VALUES(?,?,?,?,?,?,?,?,?,1,?)",
               (bids[bi], kind, ten, tes, den, des, hrs, pay, sched, now))

    sids = []
    for email, name, loc in STUDENTS:
        uni = "IE University" if "ie.edu" in email else "Universidad de Valladolid - Campus Segovia"
        sids.append(db.run("INSERT INTO students(email,name,university,verified,locale,wallet_cents,"
                           "saved_cents,created_at) VALUES(?,?,?,1,?,?,0,?)",
                           (email, name, uni, loc, 4000, now)))

    for i, (subject, pay, sched) in enumerate(STUDENT_TUTORING):
        sid = sids[i % len(sids)]
        nm = STUDENTS[i % len(STUDENTS)][1]
        db.run("INSERT INTO jobs(student_id,kind,title_en,title_es,detail_en,detail_es,hours_per_week,"
               "pay_cents,schedule,active,created_at) VALUES(?,'tutoring',?,?,?,?,0,?,?,1,?)",
               (sid, "%s tutoring" % subject, "Clases de %s" % subject,
                "Taught by %s, a verified student. Agora holds the payment." % nm,
                "Impartidas por %s, estudiante verificado. Agora retiene el pago." % nm,
                pay, sched, now))

    print("seeded: %d businesses, %d offers, %d events, %d jobs, %d students"
          % (len(bids), len(OFFERS), len(EVENTS), len(JOBS) + len(STUDENT_TUTORING), len(sids)))


if __name__ == "__main__":
    run()
