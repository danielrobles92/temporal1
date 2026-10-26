"""Metadatos del modelo v2 (multitarea): clases, tamanos por raza y fuentes.

Clases de la cabeza principal (25):
  0..19  las 20 razas de R3P0 (mismo orden que models/mx20_classes.json)
  20     Otro       -> perro de otra raza o mestizo
  21..24 No perro   -> gato | peluche/juguete | otro animal | objeto/persona/escena

Tamano (por peso adulto tipico): P < 10 kg, M 10-25 kg, G > 25 kg.
Edad (DogAge): cachorro 0-2, adulto 2-5, senior > 6 anios.
"""
import re

BREEDS = [
    "Chihuahua", "Schnauzer", "Poodle", "Yorkshire Terrier", "Pug",
    "Husky Siberiano", "Labrador Retriever", "Pitbull (American Staffordshire)",
    "Pastor Aleman", "Golden Retriever", "Bulldog Frances", "Pomerania", "Boxer",
    "Beagle", "Cocker Spaniel", "Rottweiler", "Maltes", "Shih Tzu",
    "Xoloitzcuintle", "Doberman",
]
OTRO = "Otro"
NOT_DOG = ["gato", "peluche", "animal", "objeto"]
CLASSES = BREEDS + [OTRO] + [f"no_perro:{c}" for c in NOT_DOG]
IDX_OTRO = len(BREEDS)                 # 20
IDX_NOT_DOG = IDX_OTRO + 1             # 21..24
N_CLASSES = len(CLASSES)               # 25

SIZES = ["pequeno", "mediano", "grande"]
SIZE_IDX = {"P": 0, "M": 1, "G": 2}
AGES = ["cachorro", "adulto", "senior"]

# Peso orientativo por tamano (kg) — se devuelve como rango aproximado.
SIZE_WEIGHT_KG = {"pequeno": (1, 10), "mediano": (10, 25), "grande": (25, 60)}

# Carpeta R3P0 -> indice de raza.
R3P0_FOLDERS = [
    "Chihuahua", "Schnauzer", "Poodle", "Yorkshire_Terrier", "Pug", "Husky_Siberiano",
    "Labrador_Retriever", "Pitbull_American_Staffordshire", "Pastor_Aleman",
    "Golden_Retriever", "Bulldog_Frances", "Pomerania", "Boxer", "Beagle",
    "Cocker_Spaniel", "Rottweiler", "Maltes", "Shih_Tzu", "Xoloitzcuintle", "Doberman",
]

# Tamano tipico de cada raza de R3P0. Schnauzer y Poodle tienen variantes; se
# resuelven por la carpeta de origen que conserva el nombre de archivo de R3P0.
R3P0_SIZE = {
    "Chihuahua": "P", "Yorkshire_Terrier": "P", "Pug": "P", "Husky_Siberiano": "M",
    "Labrador_Retriever": "G", "Pitbull_American_Staffordshire": "M", "Pastor_Aleman": "G",
    "Golden_Retriever": "G", "Bulldog_Frances": "P", "Pomerania": "P", "Boxer": "G",
    "Beagle": "M", "Cocker_Spaniel": "M", "Rottweiler": "G", "Maltes": "P", "Shih_Tzu": "P",
    "Xoloitzcuintle": "M", "Doberman": "G",
}


def r3p0_size(folder, filename):
    name = filename.lower()
    if folder == "Schnauzer":
        if "giant" in name:
            return "G"
        if "standard" in name:
            return "M"
        return "P"
    if folder == "Poodle":
        if "standard" in name:
            return "G"
        if "medium" in name:
            return "M"
        return "P"
    return R3P0_SIZE[folder]


def norm(name):
    """'n02085782-Japanese_spaniel' / 'japanese_spaniel' -> 'japanese spaniel'."""
    name = re.sub(r"^n\d+-", "", name)
    return re.sub(r"[_\-]+", " ", name).strip().lower()


# --- Stanford Dogs: razas que NO son de las 20 -> "Otro" (con su tamano) --------
# Las 20 de R3P0 se toman de R3P0 (ya deduplicado). Aqui solo van las demas.
STANFORD_OTRO_SIZE = {
    "japanese spaniel": "P", "pekinese": "P", "blenheim spaniel": "P", "papillon": "P",
    "toy terrier": "P", "rhodesian ridgeback": "G", "afghan hound": "G", "basset": "M",
    "bloodhound": "G", "bluetick": "G", "black and tan coonhound": "G", "walker hound": "G",
    "english foxhound": "G", "redbone": "G", "borzoi": "G", "irish wolfhound": "G",
    "italian greyhound": "P", "whippet": "M", "ibizan hound": "M", "norwegian elkhound": "M",
    "otterhound": "G", "saluki": "M", "scottish deerhound": "G", "weimaraner": "G",
    "bedlington terrier": "M", "border terrier": "P", "kerry blue terrier": "M",
    "irish terrier": "M", "norfolk terrier": "P", "norwich terrier": "P",
    "wire haired fox terrier": "P", "lakeland terrier": "P", "sealyham terrier": "P",
    "airedale": "M", "cairn": "P", "australian terrier": "P", "dandie dinmont": "P",
    "boston bull": "P", "scotch terrier": "P", "tibetan terrier": "M", "silky terrier": "P",
    "soft coated wheaten terrier": "M", "west highland white terrier": "P", "lhasa": "P",
    "flat coated retriever": "G", "curly coated retriever": "G",
    "chesapeake bay retriever": "G", "german short haired pointer": "G", "vizsla": "M",
    "english setter": "G", "irish setter": "G", "gordon setter": "G", "brittany spaniel": "M",
    "clumber": "G", "english springer": "M", "welsh springer spaniel": "M",
    "sussex spaniel": "M", "irish water spaniel": "G", "kuvasz": "G", "schipperke": "P",
    "groenendael": "G", "malinois": "G", "briard": "G", "kelpie": "M", "komondor": "G",
    "old english sheepdog": "G", "shetland sheepdog": "P", "collie": "G",
    "border collie": "M", "bouvier des flandres": "G", "miniature pinscher": "P",
    "greater swiss mountain dog": "G", "bernese mountain dog": "G", "appenzeller": "M",
    "entlebucher": "M", "bull mastiff": "G", "tibetan mastiff": "G", "great dane": "G",
    "saint bernard": "G", "malamute": "G", "affenpinscher": "P", "basenji": "P",
    "leonberg": "G", "newfoundland": "G", "great pyrenees": "G", "samoyed": "M",
    "chow": "M", "keeshond": "M", "brabancon griffon": "P", "pembroke": "M", "cardigan": "M",
}
# Casi identicas a una de las 20 y con ruido de etiqueta conocido en Stanford
# (Staffordshire vs AmStaff, Eskimo dog vs Husky) o ambiguas perro/salvaje (dingo):
# se EXCLUYEN del entrenamiento para no ensuciar ninguna de las dos clases.
STANFORD_EXCLUDE = {"staffordshire bullterrier", "eskimo dog", "dingo"}
# Canidos salvajes de Stanford -> "no_perro:animal".
STANFORD_WILD = {"dhole", "african hunting dog"}
# Las 20 razas (o sus variantes) en Stanford: ya estan en R3P0.
STANFORD_IN_R3P0 = {
    "chihuahua", "maltese dog", "shih tzu", "beagle", "american staffordshire terrier",
    "yorkshire terrier", "miniature schnauzer", "giant schnauzer", "standard schnauzer",
    "golden retriever", "labrador retriever", "cocker spaniel", "rottweiler",
    "german shepherd", "doberman", "boxer", "french bulldog", "siberian husky", "pug",
    "pomeranian", "toy poodle", "miniature poodle", "standard poodle", "mexican hairless",
}

# --- Dog Breeds Image Dataset (archive): razas extra / mestizos -> "Otro" --------
# Solo carpetas que NO estan ya en R3P0. Las que repiten Stanford se deduplican por MD5.
ARCHIVE_OTRO_SIZE = {
    "mix": None, "akita": "G", "australian cattledog": "M", "bichon frise": "P",
    "caucasian ovcharka": "G", "cavapoo": "P", "cockapoo": "P", "cotondetulear": "P",
    "dachshund": "P", "dalmatian": "G", "english bulldog": "M", "english mastiff": "G",
    "germanlonghair pointer": "G", "havanese": "P", "japanese spitz": "P",
    "kelpie australian": "M", "kombai": "M", "labradoodle": None, "lapphund finnish": "M",
    "norwegian buhund": "M", "patterdale terrier": "P", "plott hound": "G", "puggle": "P",
    "russell terrier": "P", "sharpei": "M", "shepherd australian": "M", "shiba": "M",
    "spanish waterdog": "M", "swedish danish": "P", "tervuren": "G", "welsh terrier": "P",
    "indian bakharwal": None, "indian chippiparai": None, "indian gaddi": None,
    "indian greyhound": None, "indian mastiff": None, "indian mudhol": None,
    "indian pariah": None, "indian sheepdog": None, "indian spitz": None,
    # razas de Stanford con otro nombre (aportan imagenes nuevas tras deduplicar)
    "affenpinscher": "P", "afghan hound": "G", "airedale": "M", "appenzeller": "M",
    "australian terrier": "P", "basenji": "P", "basset hound": "M", "bedlington terrier": "M",
    "bernese mountain": "G", "blenheim spaniel": "P", "blood hound": "G", "bluetick": "G",
    "border collie": "M", "border terrier": "P", "borzoi": "G", "boston bulldog": "P",
    "bouvier": "G", "brabancon": "P", "briard": "G", "brittany spaniel": "M",
    "bull mastiff": "G", "cairn terrier": "P", "cardigan corgi": "M",
    "chesapeake retriever": "G", "chow": "M", "clumber": "G", "coonhound": "G",
    "curly retriever": "G", "dandie terrier": "P", "english hound": "G",
    "english setter": "G", "english sheepdog": "G", "english springer": "M",
    "entlebucher": "M", "flatcoated retriever": "G", "fox terrier": "P",
    "german pointer": "G", "gordon setter": "G", "great dane": "G", "groenendael": "G",
    "ibizan hound": "M", "irish setter": "G", "irish spaniel": "G", "irish terrier": "M",
    "irish wolfhound": "G", "italian greyhound": "P", "japanese spaniel": "P",
    "keeshond": "M", "kelpie": "M", "kerryblue terrier": "M", "komondor": "G",
    "kuvasz": "G", "lakeland terrier": "P", "leonberg": "G", "lhasa": "P", "malamute": "G",
    "malinois": "G", "miniature pinscher": "P", "newfoundland": "G", "norfolk terrier": "P",
    "norwegian elkhound": "M", "norwich terrier": "P", "otterhound": "G", "papillon": "P",
    "pekinese": "P", "pembroke": "M", "pyrenees": "G", "redbone": "G", "saluki": "M",
    "samoyed": "M", "schipperke": "P", "scottish deerhound": "G", "scottish terrier": "P",
    "sealyham terrier": "P", "shetland sheepdog": "P", "silky terrier": "P", "stbernard": "G",
    "sussex spaniel": "M", "swiss mountain": "G", "tibetan mastiff": "G",
    "tibetan terrier": "M", "toy terrier": "P", "vizsla": "M", "walker hound": "G",
    "weimaraner": "G", "welsh spaniel": "M", "westhighland terrier": "P",
    "wheaten terrier": "M", "whippet": "M",
}
ARCHIVE_WILD = {"dhole", "african"}

# --- Oxford-IIIT Pet ----------------------------------------------------------
# Razas de perro que corresponden a una de las 20 (aportan fotos nuevas).
OXFORD_TO_BREED = {
    "beagle": "Beagle", "boxer": "Boxer", "chihuahua": "Chihuahua", "pomeranian": "Pomerania",
    "pug": "Pug", "yorkshire terrier": "Yorkshire Terrier",
    "american pit bull terrier": "Pitbull (American Staffordshire)",
    "english cocker spaniel": "Cocker Spaniel",
}
OXFORD_OTRO_SIZE = {
    "american bulldog": "G", "basset hound": "M", "english setter": "G",
    "german shorthaired": "G", "great pyrenees": "G", "havanese": "P", "japanese chin": "P",
    "keeshond": "M", "leonberger": "G", "miniature pinscher": "P", "newfoundland": "G",
    "saint bernard": "G", "samoyed": "M", "scottish terrier": "P", "shiba inu": "M",
    "wheaten terrier": "M",
}
OXFORD_EXCLUDE = {"staffordshire bull terrier"}
OXFORD_SIZE_OF_BREED = {
    "beagle": "M", "boxer": "G", "chihuahua": "P", "pomeranian": "P", "pug": "P",
    "yorkshire terrier": "P", "american pit bull terrier": "M", "english cocker spaniel": "M",
}
