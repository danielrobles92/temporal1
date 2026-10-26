# Diagramas de casos de uso (UML 2.5) con el estilo de las figuras actuales del TT2.
# Columna 1: casos base (asociados al actor). Columna 2: extend/include. Columna 3: include de la col. 2.
import json, math, sys, textwrap

FONT = "Verdana, DejaVu Sans, Arial, sans-serif"
BLUE, FILL_RECT, FILL_UC, TXT, LINE = "#0A5A97", "#EDE9C9", "#F7F7F3", "#101826", "#181818"
FS, LH, CW = 14, 18, 8.3          # tamaño de letra, alto de línea, ancho medio por carácter
GAP_COL, PAD, BELOW_GAP = 170, 40, 46            # separación entre columnas y margen interno del recuadro

def esc(t): return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def uc_size(lines):
    w = max(len(l) for l in lines) * CW / 0.82 + 34
    h = len(lines) * LH / 0.80 + 18
    return max(w, 170), max(h, 58)

def boundary(cx, cy, w, h, tx, ty):  # punto del borde de la elipse en dirección a (tx, ty)
    dx, dy = tx - cx, ty - cy
    a, b = w / 2, h / 2
    t = 1 / math.sqrt((dx / a) ** 2 + (dy / b) ** 2)
    return cx + dx * t, cy + dy * t

def build(spec, path):
    ucs = {u["id"]: u for u in spec["ucs"]}
    for u in ucs.values():
        u["lines"] = [u["id"]] + textwrap.wrap(u["name"], 28)
        u["w"], u["h"] = uc_size(u["lines"])
    col1 = spec["col1"]
    # cada caso de la col. 2/3 se ancla a un caso de la columna anterior
    anchors = spec["anchor"]          # {caso: caso_ancla}
    below = spec.get("below", {})      # {caso: caso_de_col2_encima} se apila bajo su ancla en la col. 2
    col2 = []
    for c in anchors:
        if anchors[c] in col1:
            col2.append(c)
            col2.extend(k for k, base in below.items() if base == c)
    for k, base in below.items():
        anchors[k] = anchors[base]
    col3 = [c for c in anchors if anchors[c] in col2 and c not in below]
    kids = {c: [k for k in col2 if anchors[k] == c] for c in col1}
    kids3 = {c: [k for k in col3 if anchors[k] == c] for c in col2}
    S1, S2 = 22, 16
    # bloques verticales: cada caso base reserva altura para sus hijos
    y = 0
    for c in col1:
        ks = kids[c]
        need_kids = (sum(ucs[k]["h"] for k in ks) + S2 * max(0, len(ks) - 1)
                     + BELOW_GAP * sum(1 for k in ks if k in below)) if ks else 0
        blk = max(ucs[c]["h"], need_kids) + S1
        ucs[c]["cy"] = y + blk / 2
        if ks:
            yy = ucs[c]["cy"] - need_kids / 2
            for k in ks:
                ucs[k]["cy"] = yy + ucs[k]["h"] / 2
                yy += ucs[k]["h"] + S2 + (BELOW_GAP if ks.index(k) + 1 < len(ks) and ks[ks.index(k) + 1] in below else 0)
        y += blk
    total_h = y
    for k in col3:
        ucs[k]["cy"] = ucs[anchors[k]]["cy"]
    w1 = max(ucs[c]["w"] for c in col1)
    w2 = max([ucs[c]["w"] for c in col2] or [0])
    w3 = max([ucs[c]["w"] for c in col3] or [0])
    rx = 340                           # el actor queda a la izquierda del recuadro
    top = 30 + 64                      # recuadro + espacio para el título
    L1 = rx + PAD                      # borde izquierdo común de la columna 1
    L2 = L1 + w1 + GAP_COL
    L3 = L2 + w2 + GAP_COL
    for c in col1: ucs[c]["cx"] = L1 + ucs[c]["w"] / 2
    for c in col2: ucs[c]["cx"] = L2 + ucs[c]["w"] / 2
    for c in col3: ucs[c]["cx"] = L3 + ucs[c]["w"] / 2
    for k, base in below.items(): ucs[k]["cx"] = ucs[base]["cx"]   # centrado bajo su ancla: flecha vertical
    right = (L3 + w3) if col3 else (L2 + w2) if col2 else (L1 + w1)
    rw = right + PAD - rx
    rh = total_h + 64 + PAD
    for u in ucs.values():
        if "cy" in u: u["cy"] += top
    sec = spec.get("secondary")
    W = int(rx + rw + (220 if sec else 40))
    H = int(30 + rh + 40)

    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
         '<defs>'
         f'<marker id="fill" markerWidth="12" markerHeight="10" refX="11" refY="5" orient="auto" markerUnits="userSpaceOnUse">'
         f'<path d="M0,0 L12,5 L0,10 L3,5 z" fill="{LINE}"/></marker>'
         f'<marker id="open" markerWidth="13" markerHeight="12" refX="12" refY="6" orient="auto" markerUnits="userSpaceOnUse">'
         f'<path d="M0,0 L12,6 L0,12" fill="none" stroke="{LINE}" stroke-width="1.4"/></marker></defs>',
         f'<rect width="{W}" height="{H}" fill="#FFFFFF"/>',
         f'<rect x="{rx}" y="30" width="{rw}" height="{rh}" rx="5" fill="{FILL_RECT}" stroke="{BLUE}" stroke-width="1.3"/>',
         f'<text x="{rx + rw / 2}" y="58" font-family="{FONT}" font-size="19" font-weight="bold" fill="{BLUE}" '
         f'text-anchor="middle">Plataforma Perreque</text>']

    def actor(cx, cy, name_lines):
        o.append(f'<circle cx="{cx}" cy="{cy - 46}" r="11" fill="#F1F1F1" stroke="{BLUE}" stroke-width="1.3"/>')
        o.append(f'<path d="M{cx},{cy - 35} V{cy - 5} M{cx - 20},{cy - 25} H{cx + 20} M{cx},{cy - 5} L{cx - 16},{cy + 18} '
                 f'M{cx},{cy - 5} L{cx + 16},{cy + 18}" fill="none" stroke="{BLUE}" stroke-width="1.3"/>')
        for i, ln in enumerate(name_lines):
            o.append(f'<text x="{cx - 8}" y="{cy + 40 + i * 20}" font-family="{FONT}" font-size="16" fill="#000000" '
                     f'text-anchor="middle">{esc(ln)}</text>')

    lines_svg = []
    def line(x1_, y1_, x2_, y2_, dashed=False, label=None, pos=0.5):
        style = f'stroke="{LINE}" stroke-width="1.3"' + (' stroke-dasharray="7,5"' if dashed else '')
        lines_svg.append(f'<line x1="{x1_:.1f}" y1="{y1_:.1f}" x2="{x2_:.1f}" y2="{y2_:.1f}" {style} '
                         f'marker-end="url(#{"open" if dashed else "fill"})"/>')
        if label:
            mx, my = x1_ + (x2_ - x1_) * pos, y1_ + (y2_ - y1_) * pos
            ang = math.degrees(math.atan2(y2_ - y1_, x2_ - x1_))
            if abs(abs(ang) - 90) < 30:   # línea vertical: etiqueta horizontal a la derecha
                lines_svg.append(f'<text x="{mx + 10:.1f}" y="{my + 5:.1f}" font-family="{FONT}" font-size="14" '
                                 f'fill="#000000">{esc(label)}</text>')
            else:
                if ang > 90 or ang < -90: ang += 180
                lines_svg.append(f'<text x="{mx:.1f}" y="{my - 7:.1f}" font-family="{FONT}" font-size="14" fill="#000000" '
                                 f'text-anchor="middle" transform="rotate({ang:.1f} {mx:.1f} {my:.1f})">{esc(label)}</text>')

    # actor principal, centrado respecto a la columna 1
    c1y = [ucs[c]["cy"] for c in col1]
    ax, ay = 95, (min(c1y) + max(c1y)) / 2
    for c in col1:
        u = ucs[c]
        line(ax + 22, ay - 22, u["cx"] - u["w"] / 2, u["cy"])
    for rel in spec["rels"]:  # (origen, destino, tipo[, posición de la etiqueta])
        a, b, kind = rel[:3]
        pos = rel[3] if len(rel) > 3 else 0.5
        A, B = ucs[a], ucs[b]
        sx, sy = boundary(A["cx"], A["cy"], A["w"], A["h"], B["cx"], B["cy"])
        tx, ty = boundary(B["cx"], B["cy"], B["w"], B["h"], A["cx"], A["cy"])
        line(sx, sy, tx, ty, dashed=True, label=f"«{kind}»", pos=pos)
    if sec:
        u = ucs[sec["uc"]]
        sx_ = rx + rw + 110
        ex, ey = boundary(u["cx"], u["cy"], u["w"], u["h"], sx_, u["cy"])
        line(ex, ey, sx_ - 26, u["cy"] - 25)
    o.extend(lines_svg)
    for u in ucs.values():
        if "cy" not in u: continue
        o.append(f'<ellipse cx="{u["cx"]:.1f}" cy="{u["cy"]:.1f}" rx="{u["w"] / 2:.1f}" ry="{u["h"] / 2:.1f}" '
                 f'fill="{FILL_UC}" stroke="{BLUE}" stroke-width="1.2"/>')
        n = len(u["lines"])
        y0 = u["cy"] - (n - 1) * LH / 2 + 5
        for i, ln in enumerate(u["lines"]):
            o.append(f'<text x="{u["cx"]:.1f}" y="{y0 + i * LH:.1f}" font-family="{FONT}" font-size="{FS}" fill="{TXT}" '
                     f'text-anchor="middle">{esc(ln)}</text>')
    note = spec.get("note")
    if note:
        nw = max(len(l) for l in note) * 7.4 + 30
        nh = len(note) * 18 + 22
        nx, ny = rx + rw - PAD - nw, 30 + 64
        o.append(f'<path d="M{nx},{ny} h{nw - 14} l14,14 v{nh - 14} h{-nw} z" fill="#FFFBD1" stroke="{BLUE}" stroke-width="1.1"/>')
        o.append(f'<path d="M{nx + nw - 14},{ny} v14 h14" fill="none" stroke="{BLUE}" stroke-width="1.1"/>')
        for i, ln in enumerate(note):
            o.append(f'<text x="{nx + 14}" y="{ny + 24 + i * 18}" font-family="{FONT}" font-size="13" fill="{TXT}">{esc(ln)}</text>')
    actor(ax, ay, spec["actor"].split("|"))
    if sec:
        actor(rx + rw + 110, ucs[sec["uc"]]["cy"], sec["name"])
    o.append('</svg>')
    open(path, "w", encoding="utf-8").write("\n".join(o))
    print(path, W, H)
    return W, H

if __name__ == "__main__":
    specs = json.load(open(sys.argv[1], encoding="utf-8"))
    sizes = {}
    for name, spec in specs.items():
        sizes[name] = build(spec, f"{name}.svg")
    json.dump(sizes, open("sizes.json", "w"))
