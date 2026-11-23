"""Demo data for Ágora, built on real Segovia venues.

IMPORTANT — these are REAL businesses and venues in Segovia, used so the demo is
recognisable to the students who will test it. None of them has agreed to
anything: every discount, price and review below is INVENTED for the prototype.
The apps and the public site must carry a visible demo notice wherever this data
is shown. `real_name=1` marks the rows this applies to.

Coordinates are approximate, good enough to place a pin on the right street.
"""
import json, random
from . import db, leisure

COMMISSION_FOR_SEED = 8.0   # mirrors api.COMMISSION_PCT without importing it

DEMO_NOTICE_ES = ("Negocios reales de Segovia. Los descuentos, precios y reseñas "
                  "son ficticios: esto es una demostración, no una oferta.")
DEMO_NOTICE_EN = ("Real Segovia businesses. The discounts, prices and reviews are "
                  "invented: this is a demo, not an offer.")

# name, category, zone, address, lat, lng, es, en, tags
VENUES = [
    ("info@mesondecandido.es", "Mesón de Cándido", "restaurant", "centro",
     "Plaza del Azoguejo 5", 40.9478, -4.1172,
     "Asador histórico al pie del acueducto, conocido por el cochinillo cortado con el borde de un plato.",
     "Historic roast house at the foot of the aqueduct, known for suckling pig carved with the edge of a plate.",
     ["cochinillo", "asador", "clásico"]),
    ("reservas@restaurantejosemaria.com", "Restaurante José María", "restaurant", "centro",
     "Calle Cronista Lecea 11", 40.9497, -4.1248,
     "Cocina segoviana junto a la Plaza Mayor, con bodega propia.",
     "Segovian cooking beside the Plaza Mayor, with its own winery.",
     ["cochinillo", "vino", "tapas"]),
    ("hola@mesonduque.es", "Mesón Duque", "restaurant", "centro",
     "Calle Cervantes 12", 40.9470, -4.1198,
     "Mesón de leña en la cuesta que sube del acueducto, abierto desde 1895.",
     "Wood-fired mesón on the slope up from the aqueduct, open since 1895.",
     ["asador", "tradicional"]),
    ("tienda@limonymenta.es", "Limón y Menta", "shop", "centro",
     "Calle Isabel la Católica 2", 40.9494, -4.1243,
     "Pastelería del centro, famosa por el ponche segoviano.",
     "Pastry shop in the centre, famous for ponche segoviano.",
     ["pastelería", "ponche", "café"]),
    ("taquilla@teatrojuanbravo.org", "Teatro Juan Bravo", "culture", "centro",
     "Plaza Mayor 6", 40.9502, -4.1255,
     "El teatro de la ciudad, en la Plaza Mayor, con programación todo el año.",
     "The city theatre, on the Plaza Mayor, programming all year round.",
     ["teatro", "cultura", "escena"]),
    ("segovia@artesiete.es", "Cines Artesiete Segovia", "culture", "nueva",
     "Calle Dámaso Alonso 54", 40.9345, -4.1062,
     "Multicines en Nueva Segovia, con sesiones de tarde entre semana.",
     "Multiplex in Nueva Segovia, with weekday afternoon screenings.",
     ["cine", "estrenos"]),
    ("info@luzdecastilla.es", "C.C. Luz de Castilla", "shop", "nueva",
     "Calle de Guadarrama s/n", 40.9338, -4.1049,
     "Centro comercial de Nueva Segovia: tiendas, restauración y ocio bajo un techo.",
     "Shopping centre in Nueva Segovia: shops, food and leisure under one roof.",
     ["compras", "centro comercial"]),
    ("alcazar@patrimoniosegovia.es", "Alcázar de Segovia", "culture", "centro",
     "Plaza Reina Victoria Eugenia s/n", 40.9527, -4.1327,
     "La fortaleza sobre la confluencia del Eresma y el Clamores.",
     "The fortress above where the Eresma and the Clamores meet.",
     ["monumento", "visita", "historia"]),
    ("pistas@padelsegovia.es", "Pádel Segovia", "sport", "zorrilla",
     "Calle José Zorrilla 101", 40.9430, -4.1180,
     "Pistas cubiertas de pádel, con alquiler de pala incluido.",
     "Indoor padel courts, racket hire included.",
     ["pádel", "deporte", "pistas"]),
    # Football. Gimnástica Segoviana CF plays at the Estadio de La Albuera, on
    # the east side of the city (source: espanaestadios.com, Wikipedia).
    ("taquilla@gimnasticasegoviana.com", "Gimnástica Segoviana CF", "sport", "nueva",
     "Estadio de La Albuera", 40.9440, -4.1065,
     "El club de la ciudad desde 1928, en La Albuera, al este de Segovia.",
     "The city's club since 1928, at La Albuera on the east side of Segovia.",
     ["fútbol", "liga", "estadio"]),
    # Clubbing. Listed as a discoteca by the Castilla y León tourism portal,
    # Calle Juan de Borbón y Battenberg 47. Coordinates approximate.
    ("sala@zibasegovia.es", "Zibá", "nightlife", "zorrilla",
     "Calle Juan de Borbón y Battenberg 47", 40.9405, -4.1125,
     "Sala de noche fuera del casco, con sesiones de fin de semana.",
     "Night venue outside the old town, with weekend sessions.",
     ["noche", "sala", "música"]),
    ("hola@lacasadelsiglo.es", "La Casa del Siglo XV", "restaurant", "sanlo",
     "Calle Escuderos 1", 40.9513, -4.1262,
     "Comedor en una casa del XV, menú del día en el casco.",
     "Dining room in a 15th-century house, set lunch in the old town.",
     ["menú", "tradicional"]),
]

# venue index, leisure category, kind, title es/en, detail, list, student, stock, window
OFFERS = [
    (0, "restaurants", "fixed", "Cochinillo para dos, precio estudiante", "Suckling pig for two, student price",
     "Medio cochinillo para compartir. Reserva por la app.",
     "Half a suckling pig to share. Book through the app.", 6400, 4800, 8, "Lun–Jue"),
    (1, "restaurants", "percent", "20% en la carta", "20% off the menu",
     "Válido en comidas de lunes a jueves.", "Valid for lunch, Monday to Thursday.",
     2800, 2240, 0, "Lun–Jue mediodía"),
    (2, "restaurants", "fixed", "Menú estudiante", "Student set menu",
     "Primero, segundo, postre y bebida.", "Starter, main, dessert and a drink.",
     1900, 1250, 0, "Lun–Vie"),
    (3, "products", "percent", "25% en ponche y bollería", "25% off ponche and pastries",
     "Para llevar o para la mesa.", "To take away or to sit in.", 600, 450, 0, ""),
    (4, "theatre", "fixed", "Butaca estudiante", "Student seat",
     "Bloque de butacas reservado en cada función.", "A block of seats held at every performance.",
     2200, 900, 30, "Toda la programación"),
    (5, "cinema", "twofor", "2x1 de martes a jueves", "2-for-1, Tuesday to Thursday",
     "Dos entradas al precio de una.", "Two tickets for the price of one.", 1700, 850, 40, "Mar–Jue"),
    (6, "products", "percent", "15% en comercios adheridos", "15% in participating shops",
     "Enseña el pase en caja.", "Show your pass at the till.", 3000, 2550, 0, ""),
    (7, "products", "fixed", "Entrada estudiante al Alcázar", "Student entry to the Alcázar",
     "Incluye palacio y Torre de Juan II.", "Palace and the Tower of John II included.",
     900, 500, 0, ""),
    (8, "play", "bundle", "Pista + palas, 90 minutos", "Court + rackets, 90 minutes",
     "Pista cubierta para cuatro, palas incluidas.", "Indoor court for four, rackets included.",
     2400, 1600, 12, "Lun–Jue 16:00–19:00"),
    (9, "football", "fixed", "Entrada de fondo, precio estudiante", "Terrace ticket, student price",
     "Fondo sur en los partidos de liga en casa.", "South terrace for home league games.",
     1500, 700, 120, "Partidos en casa"),
    (10, "club", "bundle", "Entrada + dos consumiciones", "Entry + two drinks",
     "Viernes y sábado, antes de la una.", "Friday and Saturday, before one in the morning.",
     1800, 1000, 60, "Vie–Sáb antes de 01:00"),
    (11, "restaurants", "fixed", "Menú del día", "Set lunch",
     "Menú completo en el casco histórico.", "Full set lunch in the old town.", 1800, 1200, 0, "Lun–Vie"),
]

# venue, leisure category, legacy category, title es/en, detail, in days, list, student, capacity, featured
EVENTS = [
    (4, "theatre", "theatre", "La vida es sueño", "La vida es sueño",
     "Calderón en el Juan Bravo, con sobretítulos en inglés.",
     "Calderón at the Juan Bravo, with English surtitles.", 4, 2200, 900, 60, 1),
    (9, "football", "sport_watch", "Gimnástica Segoviana – jornada en casa", "Gimnástica Segoviana – home game",
     "Partido de liga en La Albuera, fondo sur para estudiantes.",
     "League game at La Albuera, south terrace for students.", 2, 1500, 700, 120, 1),
    (10, "club", "party", "Jueves estudiante", "Student Thursday",
     "Sesión de estudiantes con dos consumiciones.", "Student session with two drinks included.",
     3, 1800, 1000, 90, 1),
    (5, "cinema", "cinema", "Estreno de los jueves", "Thursday premiere",
     "Sesión de estreno con precio de estudiante.", "Premiere screening at a student price.",
     3, 900, 550, 80, 0),
    (8, "play", "sport_play", "Torneo abierto de pádel", "Open padel tournament",
     "Parejas, tres rondas, pala incluida.", "Pairs, three rounds, racket included.", 6, 1600, 900, 24, 0),
    (7, "products", "tour", "Visita nocturna al Alcázar", "Alcázar by night",
     "Recorrido guiado de noventa minutos.", "A ninety-minute guided walk.", 5, 1500, 700, 35, 0),
]

# The five who have reviews written against them by index, kept first and stable.
STUDENTS = [
    ("marta.ruiz@student.ie.edu", "Marta Ruiz", "es", "Business Administration", 2),
    ("liam.oconnor@student.ie.edu", "Liam O'Connor", "en", "International Relations", 1),
    ("sofia.martin@uva.es", "Sofía Martín", "es", "Publicidad y RRPP", 3),
    ("noah.becker@student.ie.edu", "Noah Becker", "en", "Business Administration", 2),
    ("lucia.perez@uva.es", "Lucía Pérez", "es", "Ingeniería Informática", 1),
]

# A cohort big enough for "my university" to mean something. Degrees are the
# real ones taught on the two Segovia campuses. Sizes are deliberately uneven:
# some degrees clear the five-person privacy threshold and some do not, which
# is the behaviour the screen has to demonstrate.
COHORT = [
    # degree, university domain, how many, years
    ("Business Administration",      "student.ie.edu", 9, (1, 2, 3, 4)),
    ("International Relations",      "student.ie.edu", 7, (1, 2, 3)),
    ("Data & Business Analytics",    "student.ie.edu", 6, (1, 2, 3)),
    ("Design",                       "student.ie.edu", 3, (1, 2)),
    ("Publicidad y RRPP",            "uva.es",         8, (1, 2, 3, 4)),
    ("Comunicación Audiovisual",     "uva.es",         6, (1, 2, 3)),
    ("Ingeniería Informática",       "uva.es",         5, (1, 2, 3, 4)),
    ("Turismo",                      "uva.es",         2, (2, 3)),
]

FIRST = ["Marta", "Lucía", "Sofía", "Paula", "Elena", "Carmen", "Ana", "Irene", "Clara",
         "Pablo", "Javier", "Diego", "Álvaro", "Hugo", "Mario", "Sergio", "Adrián",
         "Liam", "Noah", "Emma", "Olivia", "Luca", "Mateo", "Chloe", "Yusuf", "Ravi"]
LAST = ["Ruiz", "Pérez", "Martín", "Gómez", "Sanz", "Herrero", "Arribas", "De Pablos",
        "Llorente", "Bravo", "Tejedor", "Olmos", "Becker", "O'Connor", "Rossi",
        "Dubois", "Novak", "Khan", "Silva", "Andersen"]

# venue, student, rating, body, status
REVIEWS = [
    (0, 0, 5, "Caro para el día a día, pero una vez al trimestre merece la pena. El precio de estudiante lo hace posible.", "published"),
    (2, 1, 4, "Good food, slow service when it is full. Go early.", "published"),
    (3, 2, 5, "El ponche es el mejor de Segovia y con el 25% ya no es un capricho.", "published"),
    (4, 1, 5, "Surtitles in English made it work for me. I would not have gone otherwise.", "published"),
    (5, 3, 3, "Fine for a Thursday, but the 2-for-1 only works if you find someone to go with.", "published"),
    (8, 4, 4, "Pista nueva y palas decentes. Lo de las 16:00 está siempre libre.", "published"),
    (1, 4, 2, "Me pareció turístico y la ración pequeña para el precio.", "pending"),
    (6, 0, 3, "Está lejos del centro, solo compensa si ya vas a Nueva Segovia.", "pending"),
]


def _evening(ts):
    import time as _t
    lt = _t.localtime(ts)
    return int(_t.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday, 20, 0, 0, 0, 0, -1)))


def wipe():
    conn = db.connect()
    for t in ("reviews", "applications", "transactions", "jobs", "events", "offers",
              "assistant_state", "sessions", "verifications", "businesses", "students"):
        conn.execute("DELETE FROM %s" % t)
    conn.commit(); conn.close()


def run():
    db.init(); wipe()
    now = db.now()

    bids = []
    for email, name, cat, zone, addr, lat, lng, des, den, tags in VENUES:
        bids.append(db.run(
            "INSERT INTO businesses(email,name,category,zone,address,description_en,description_es,"
            "tags,premium,profile_complete,verified,lat,lng,real_name,created_at) "
            "VALUES(?,?,?,?,?,?,?,?,1,1,1,?,?,1,?)",
            (email, name, cat, zone, addr, den, des, json.dumps(tags), lat, lng, now)))
        db.run("INSERT OR IGNORE INTO assistant_state(business_id) VALUES(?)", (bids[-1],))

    for bi, leis, kind, tes, ten, des, den, lc, sc, stock, win in OFFERS:
        assert leis in leisure.KEYS, "categoría de ocio desconocida: %s" % leis
        db.run("INSERT INTO offers(business_id,leisure,kind,title_en,title_es,detail_en,detail_es,"
               "list_cents,student_cents,stock,claimed,window_label,active,created_at) "
               "VALUES(?,?,?,?,?,?,?,?,?,?,0,?,1,?)",
               (bids[bi], leis, kind, ten, tes, den, des, lc, sc, stock, win, now))

    for bi, leis, cat, tes, ten, des, den, days, lc, sc, cap, feat in EVENTS:
        assert leis in leisure.KEYS, "categoría de ocio desconocida: %s" % leis
        db.run("INSERT INTO events(business_id,leisure,category,title_en,title_es,detail_en,detail_es,"
               "starts_at,venue,list_cents,student_cents,capacity,sold,featured,active,created_at) "
               "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)",
               (bids[bi], leis, cat, ten, tes, den, des, _evening(now + days * 86400),
                VENUES[bi][1], lc, sc, cap, random.randint(3, max(4, cap // 4)), feat, now))

    sids = []
    for email, name, loc, degree, year in STUDENTS:
        uni = "IE University" if "ie.edu" in email else "Universidad de Valladolid - Campus Segovia"
        sids.append(db.run(
            "INSERT INTO students(email,name,university,verified,locale,degree,year,"
            "wallet_cents,saved_cents,created_at,invite_code) VALUES(?,?,?,1,?,?,?,?,0,?,?)",
            (email, name, uni, loc, degree, year, 4000, now, db.invite_for(name))))

    # --- the wider cohort, generated from COHORT with a fixed seed
    rnd = random.Random(1928)   # the year the Gimnástica was founded; any fixed seed
    used = {e for e, *_ in STUDENTS}
    for degree, dom, count, years in COHORT:
        for _ in range(count):
            for _try in range(40):
                fn, ln = rnd.choice(FIRST), rnd.choice(LAST)
                slug = (fn + "." + ln.split()[-1]).lower()
                for ch, rep in (("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"),
                                ("ú", "u"), ("ñ", "n"), ("'", "")):
                    slug = slug.replace(ch, rep)
                email = "%s@%s" % (slug, dom)
                if email not in used:
                    break
            else:
                continue
            used.add(email)
            uni = "IE University" if "ie.edu" in dom else "Universidad de Valladolid - Campus Segovia"
            sids.append(db.run(
                "INSERT INTO students(email,name,university,verified,locale,degree,year,"
                "wallet_cents,saved_cents,created_at,invite_code) VALUES(?,?,?,1,?,?,?,?,0,?,?)",
                (email, fn + " " + ln, uni, "en" if dom == "student.ie.edu" else "es",
                 degree, rnd.choice(years), rnd.randrange(1000, 6000), now,
                 db.invite_for(fn + ln))))

    # --- activity, so "my university" has something true to aggregate
    all_offers = db.q("SELECT id,business_id,list_cents,student_cents FROM offers WHERE active=1")
    all_events = db.q("SELECT id,business_id,list_cents,student_cents FROM events WHERE active=1")
    made = 0
    for si in sids:
        for _ in range(rnd.randrange(0, 5)):
            use_event = all_events and rnd.random() < 0.4
            row = rnd.choice(all_events if use_event else all_offers)
            paid, lst = row["student_cents"], row["list_cents"]
            comm = int(round(paid * COMMISSION_FOR_SEED / 100.0))
            db.run("INSERT INTO transactions(student_id,business_id,ref_type,ref_id,list_cents,"
                   "paid_cents,saved_cents,commission_cents,platform_fee_cents,code,status,"
                   "created_at,completed_at) VALUES(?,?,?,?,?,?,?,?,?,?,'completed',?,?)",
                   (si, row["business_id"], "event" if use_event else "offer", row["id"],
                    lst, paid, lst - paid, comm, 120 if use_event else 0,
                    db.code6(), now - rnd.randrange(0, 21 * 86400), now))
            db.run("UPDATE students SET saved_cents = saved_cents + ? WHERE id=?",
                   (lst - paid, si))
            made += 1

    for bi, si, rating, body, status in REVIEWS:
        db.run("INSERT INTO reviews(business_id,student_id,rating,body,status,created_at) "
               "VALUES(?,?,?,?,?,?)", (bids[bi], sids[si], rating, body, status, now))

    print("seeded: %d venues reales de Segovia, %d ofertas, %d eventos, %d estudiantes, "
          "%d reseñas, %d compras"
          % (len(bids), len(OFFERS), len(EVENTS), len(sids), len(REVIEWS), made))
    print("AVISO: negocios reales, descuentos ficticios. La interfaz debe decirlo.")


if __name__ == "__main__":
    run()
