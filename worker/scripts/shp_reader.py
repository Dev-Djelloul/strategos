"""Lecteur SHP/DBF minimal, partagé par les scripts build_*_control.py qui
consomment un jeu de données HDX distribué uniquement au format Shapefile
(ACAPS Yémen, OCHA oPt Cisjordanie...). Bibliothèque standard uniquement.

Limite du lecteur SHP : ne gère que le type 5 (Polygon, seul type utilisé
par ces jeux de données) ; chaque anneau (« part ») est exporté comme un
polygone séparé d'un MultiPolygon, sans distinguer contour externe et trou
— sans conséquence pour des polygones simples ou multi-parties sans trou.
"""
import struct


def read_dbf(data: bytes) -> list[dict]:
    """Champs texte/numériques usuels des shapefiles HDX."""
    n_records, header_len, record_len = struct.unpack_from("<I H H", data, 4)
    fields = []
    pos = 32
    while data[pos] != 0x0D:
        name = data[pos : pos + 11].split(b"\x00")[0].decode("ascii")
        length = data[pos + 16]
        fields.append((name, length))
        pos += 32
    records = []
    pos = header_len
    for _ in range(n_records):
        row = data[pos : pos + record_len]
        pos += record_len
        if row[0:1] == b"*":  # enregistrement supprimé
            continue
        rec, off = {}, 1
        for name, length in fields:
            rec[name] = row[off : off + length].decode("latin-1").strip()
            off += length
        records.append(rec)
    return records


def read_shp(data: bytes) -> list[list[list[list[float]]]]:
    """Renvoie, par enregistrement, une liste d'anneaux (chacun une liste de
    points [lon, lat])."""
    shapes = []
    pos = 100  # en-tête fichier fixe
    while pos < len(data):
        _rec_num, content_len = struct.unpack_from(">II", data, pos)
        content_start = pos + 8
        shape_type = struct.unpack_from("<I", data, content_start)[0]
        rings: list[list[list[float]]] = []
        if shape_type == 5:
            num_parts, num_points = struct.unpack_from("<ii", data, content_start + 36)
            parts_off = content_start + 44
            points_off = parts_off + 4 * num_parts
            parts = list(struct.unpack_from(f"<{num_parts}i", data, parts_off)) + [num_points]
            points = struct.unpack_from(f"<{2 * num_points}d", data, points_off)
            for i in range(num_parts):
                start, end = parts[i], parts[i + 1]
                ring = [[points[2 * j], points[2 * j + 1]] for j in range(start, end)]
                rings.append(ring)
        shapes.append(rings)
        pos = content_start + content_len * 2  # content_len en mots de 16 bits
    return shapes
