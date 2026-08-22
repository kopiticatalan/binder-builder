"""Bombay High Court scrape — stdlib only. JSON shapes match the Metro desk."""
from __future__ import annotations

import base64
import html
import json
import re
import ssl
import urllib.parse
import urllib.request
import http.cookiejar
import zlib
from concurrent.futures import ThreadPoolExecutor

SITE = "https://bombayhighcourt.gov.in"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.4 Safari/605.1.15"
)

CASE_TOKEN = r"[A-Z]{2,8}(?:\([A-Z]+\))?/\d+/\d{4}"
LEAD_RE = re.compile(r"(\d+)\s+(" + CASE_TOKEN + r")")
CONN_RE = re.compile(r"(?i)\b(?:with|a/?w|along\s*with)\s+(" + CASE_TOKEN + r")")

_TYPE_CACHE = {}


def strip_tags(s):
    return re.sub(r"<[^>]+>", " ", s or "")


def clean(s):
    return re.sub(r"\s+", " ", html.unescape(s or "")).strip()


def sanitize(s, maxlen=80):
    s = re.sub(r'[\\/:*?"<>|]', "", s or "")
    s = re.sub(r"\s+", " ", s).strip().rstrip(".")
    return s[:maxlen].strip()


def short(s, n=55):
    s = (s or "").strip()
    return s[:n].strip() if len(s) > n else s


def excerpt_text(text, max_len=3500):
    t = re.sub(r"\s+", " ", text or "").strip()
    return t[:max_len].strip() if len(t) > max_len else t


def extract_input_value(page, name):
    m = re.search(
        r'<input[^>]*\bname="%s"[^>]*\bvalue="([^"]*)"' % re.escape(name),
        page,
        re.I,
    )
    if m:
        return m.group(1)
    m = re.search(
        r'<input[^>]*\bvalue="([^"]*)"[^>]*\bname="%s"' % re.escape(name),
        page,
        re.I,
    )
    return m.group(1) if m else ""


def abs_url(href):
    if not href:
        return href
    if href.startswith("http"):
        return href
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/"):
        return SITE + href
    return SITE + "/" + href.lstrip("/")


def make_opener():
    cj = http.cookiejar.CookieJar()
    ctx = ssl.create_default_context()
    try:
        ctx.options |= getattr(ssl, "OP_LEGACY_SERVER_CONNECT", 0x4)
    except Exception:
        pass
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(cj),
        urllib.request.HTTPSHandler(context=ctx),
        urllib.request.HTTPRedirectHandler(),
    )
    opener.addheaders = [("User-Agent", UA), ("Accept", "*/*")]
    return opener


def get_case_types(side):
    key = str(side)
    if key in _TYPE_CACHE:
        return _TYPE_CACHE[key]
    opener = make_opener()
    url = SITE + "/bhc/get-case-types-by-side?side=" + urllib.parse.quote(key)
    req = urllib.request.Request(url, headers={"X-Requested-With": "XMLHttpRequest"})
    with opener.open(req, timeout=30) as r:
        data = json.loads(r.read().decode("utf-8", "replace"))
    out = []
    for t in data if isinstance(data, list) else []:
        if not t or t.get("case_type") is None:
            continue
        name = t.get("type_name") or ""
        full = t.get("full_form") or name
        out.append(
            {
                "value": str(t["case_type"]),
                "label": (name + " - " + full) if name else full,
            }
        )
    out.sort(key=lambda x: x["label"])
    _TYPE_CACHE[key] = out
    return out


def search_case(params):
    opener = make_opener()
    page_url = SITE + "/bhc/casestatus/casenumber"
    with opener.open(urllib.request.Request(page_url), timeout=30) as r:
        page = r.read().decode("utf-8", "replace")
    token = extract_input_value(page, "_token")
    secret = extract_input_value(page, "form_secret")
    if not token:
        raise RuntimeError("Could not obtain a session token from the court site.")
    body = urllib.parse.urlencode(
        {
            "_token": token,
            "form_secret": secret,
            "side": params["side"],
            "stampreg": params["stampreg"],
            "case_type": params["case_type"],
            "case_no": params["case_no"],
            "year": params["year"],
        }
    ).encode()
    req = urllib.request.Request(page_url, data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
    req.add_header("X-Requested-With", "XMLHttpRequest")
    req.add_header("Referer", page_url)
    with opener.open(req, timeout=60) as r:
        raw = r.read().decode("utf-8", "replace")
    try:
        j = json.loads(raw)
    except Exception:
        raise RuntimeError("The court site returned an unexpected response.")
    if not j.get("status") or not j.get("page"):
        raise RuntimeError(j.get("message") or "No case found for those details.")
    page_html = j["page"]
    petitioner, respondent = extract_parties(page_html)
    orders = extract_orders(page_html)
    meta = extract_meta(page_html)
    meta["next_listing"] = extract_label_date(page_html, "Next Listing Date") or meta.get(
        "next_listing", ""
    )
    return {
        "opener": opener,
        "petitioner": petitioner,
        "respondent": respondent,
        "orders": orders,
        "meta": meta,
    }


def extract_parties(page):
    text = clean(strip_tags(page))
    m = re.search(
        r"\bby\s+(.+?)\s+against\s+(.+?)"
        r"(?:\s+District|\s+Filing Number|\s+Lodging Number|\s+Registration Date|"
        r"\s+Next Listing|\s+Disposal|\.\s|$)",
        text,
        re.I,
    )
    if m:
        return clean(m.group(1)), clean(m.group(2))
    return "", ""


def _after_label(text, label):
    m = re.search(re.escape(label) + r"\s*[:\-–]?\s*([^\n]{1,80})", text, re.I)
    return clean(m.group(1)) if m else ""


def _date_after(text, label):
    m = re.search(re.escape(label) + r"[^0-9]{0,24}(\d{2}/\d{2}/\d{4})", text, re.I)
    return m.group(1) if m else ""


def extract_meta(page):
    text = clean(strip_tags(page))
    cnr = re.search(r"\b(HCBM\w+)\b", text)
    filed = re.search(r"filed on\s+(\d{2}/\d{2}/\d{4})", text, re.I)
    status_raw = _after_label(text, "Status")
    status = re.sub(r"Petitioner.*$", "", status_raw, flags=re.I).replace("_", " ").strip()[:48]
    lodging_m = re.search(r"Lodging Number\s+([A-Z]+\(?L?\)?/\d+/\d{4})", text, re.I)
    pet_adv = re.sub(
        r"Respondent's Advocate.*$",
        "",
        _after_label(text, "Petitioner's Advocate"),
        flags=re.I,
    )[:120]
    res_adv = re.sub(
        r"Last Date.*$", "", _after_label(text, "Respondent's Advocate"), flags=re.I
    )[:120]
    stage = re.sub(r"Last Coram.*$", "", _after_label(text, "Stage"), flags=re.I)[:80]
    act = re.sub(r"Under Section.*$", "", _after_label(text, "Act"), flags=re.I)[:80]
    last_coram = re.sub(r"Act .*$", "", _after_label(text, "Last Coram"), flags=re.I)[:160]
    return {
        "cnr": cnr.group(1) if cnr else "",
        "filed_on": filed.group(1) if filed else "",
        "registration_date": _date_after(text, "Registration Date"),
        "status": status,
        "disposal_date": _date_after(text, "Disposal Date"),
        "lodging": lodging_m.group(1) if lodging_m else "",
        "next_listing": _date_after(text, "Next Listing Date"),
        "petitioner_adv": "" if pet_adv == "—" else pet_adv,
        "respondent_adv": "" if res_adv == "—" else res_adv,
        "stage": "" if stage == "—" else stage,
        "act": act,
        "last_coram": "" if last_coram == "—" else last_coram,
    }


def extract_orders(page):
    idx = page.find("View Document")
    if idx < 0:
        m = re.search(r"order-pdf|file/download|casestatus/order", page, re.I)
        idx = m.start() if m else -1
    if idx < 0:
        return []
    start = page.rfind("<table", 0, idx)
    end = page.find("</table>", idx)
    table = page[start:end] if (start >= 0 and end >= 0) else page
    orders = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S | re.I):
        href = re.search(
            r'href="([^"]*(?:file/download|order-pdf|casestatus/order)[^"]*)"',
            row,
            re.I,
        )
        if not href:
            continue
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S | re.I)
        texts = [clean(strip_tags(c)) for c in cells]
        srl = texts[0] if texts else ""
        date = ""
        for t in texts:
            m = re.search(r"\d{2}/\d{2}/\d{4}", t)
            if m:
                date = m.group(0)
                break
        doc = texts[3] if len(texts) >= 4 else ""
        coram = texts[1] if len(texts) >= 2 else ""
        link = abs_url(html.unescape(href.group(1)))
        orders.append(
            {
                "srl": srl,
                "date": date,
                "doc": doc,
                "coram": coram,
                "href": link,
                "key": order_key({"date": date, "doc": doc}),
            }
        )
    return orders


def extract_label_date(page, label):
    text = clean(strip_tags(page))
    m = re.search(re.escape(label) + r"\s*(\d{2}/\d{2}/\d{4})", text, re.I)
    return m.group(1) if m else ""


def order_key(o):
    return (o.get("date", "") + "|" + (o.get("doc", "") or "")).strip("|")


def to_lookup(result):
    meta = result.get("meta") or {}
    orders = []
    for o in result.get("orders") or []:
        orders.append(
            {
                "key": o.get("key") or order_key(o),
                "srl": o.get("srl") or "",
                "date": o.get("date") or "",
                "doc": o.get("doc") or "",
                "coram": o.get("coram") or "",
            }
        )
    return {
        "petitioner": result.get("petitioner") or "",
        "respondent": result.get("respondent") or "",
        "cnr": meta.get("cnr") or "",
        "filed_on": meta.get("filed_on") or "",
        "registration_date": meta.get("registration_date") or meta.get("filed_on") or "",
        "status": meta.get("status") or "",
        "disposal_date": meta.get("disposal_date") or "",
        "lodging": meta.get("lodging") or "",
        "next_listing": meta.get("next_listing") or "",
        "petitioner_adv": meta.get("petitioner_adv") or "",
        "respondent_adv": meta.get("respondent_adv") or "",
        "stage": meta.get("stage") or "",
        "act": meta.get("act") or meta.get("type_name") or "",
        "last_coram": meta.get("last_coram") or "",
        "orders": orders,
    }


def download_pdf_bytes(opener, url, referer=None):
    headers = {"X-Requested-With": "XMLHttpRequest", "Accept": "application/pdf,*/*"}
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers)
    with opener.open(req, timeout=90) as r:
        data = r.read()
    if data[:5] != b"%PDF-":
        return None
    return data


def files_from_orders(opener, orders, keys, parties, referer=None):
    want = set(keys or [])
    pet = sanitize(parties.get("petitioner") or "Petitioner", 40)
    resp = sanitize(parties.get("respondent") or "Respondent", 40)
    files = []
    for o in orders:
        k = o.get("key") or order_key(o)
        if want and k not in want:
            continue
        href = o.get("href")
        if not href:
            continue
        try:
            data = download_pdf_bytes(opener, href, referer)
            if not data:
                continue
            ddmmyyyy = (o.get("date") or "").replace("/", "")
            fname = sanitize("%s %s v %s" % (ddmmyyyy, pet, resp)) + ".pdf"
            files.append(
                {
                    "key": k,
                    "filename": fname,
                    "base64": base64.b64encode(data).decode("ascii"),
                    "excerpt": excerpt_text(pdf_text(data)),
                    "date": o.get("date") or "",
                    "doc": o.get("doc") or "",
                    "coram": o.get("coram") or "",
                }
            )
        except Exception:
            continue
    return files


def download_bhc_orders(params, keys, parties):
    result = search_case(params)
    return files_from_orders(
        result["opener"],
        result["orders"],
        keys,
        {
            "petitioner": parties.get("petitioner") or result["petitioner"],
            "respondent": parties.get("respondent") or result["respondent"],
        },
        SITE + "/bhc/casestatus/casenumber",
    )


def _inflate(raw):
    for wbits in (15, -15, 47):
        try:
            d = zlib.decompressobj(wbits)
            out = d.decompress(raw) + d.flush()
            if out:
                return out
        except Exception:
            continue
    return None


def _pdf_extract_ops(b):
    s = b.decode("latin1")
    res = []
    i, L = 0, len(s)
    while i < L:
        c = s[i]
        if c == "(":
            j = i + 1
            depth = 1
            buf = []
            while j < L and depth > 0:
                d = s[j]
                if d == "\\":
                    n = s[j + 1] if j + 1 < L else ""
                    if n == "n":
                        buf.append("\n")
                    elif n == "r":
                        pass
                    elif n == "t":
                        buf.append(" ")
                    elif n and n in "01234567":
                        o = n
                        k = j + 2
                        while k < L and s[k] in "01234567" and len(o) < 3:
                            o += s[k]
                            k += 1
                        buf.append(chr(int(o, 8) & 0xFF))
                        j = k
                        continue
                    else:
                        buf.append(n)
                    j += 2
                    continue
                if d == "(":
                    depth += 1
                    buf.append(d)
                    j += 1
                elif d == ")":
                    depth -= 1
                    if depth > 0:
                        buf.append(d)
                    j += 1
                else:
                    buf.append(d)
                    j += 1
            res.append("".join(buf))
            i = j
            continue
        if s.startswith("Td", i) or s.startswith("TD", i) or s.startswith("T*", i):
            res.append("\n")
            i += 2
            continue
        i += 1
    return "".join(res)


def pdf_text(data):
    out = []
    i = 0
    while True:
        s = data.find(b"stream", i)
        if s < 0:
            break
        j = s + 6
        if data[j : j + 2] == b"\r\n":
            j += 2
        elif data[j : j + 1] in (b"\n", b"\r"):
            j += 1
        e = data.find(b"endstream", j)
        if e < 0:
            break
        raw = data[j:e]
        i = e + 9
        dec = _inflate(raw)
        if dec is None:
            continue
        if b"Tj" not in dec and b"TJ" not in dec:
            continue
        try:
            out.append(_pdf_extract_ops(dec))
        except Exception:
            pass
    return "".join(out).replace("\x00", "")


def parse_causelist_judges(page):
    judges = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S | re.I):
        if "file/download" not in row:
            continue
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S | re.I)
        judge = clean(strip_tags(cells[0])) if cells else ""
        links = []
        for href, inner in re.findall(
            r'href="([^"]*file/download[^"]*)"[^>]*>(.*?)</a>', row, re.S | re.I
        ):
            label = clean(strip_tags(inner)) or "Causelist"
            links.append({"href": abs_url(html.unescape(href)), "label": label})
        if judge and links:
            judges.append({"judge": judge, "links": links})
    return judges


def _firm_regex(name):
    tokens = re.findall(r"[A-Za-z]+", name or "")
    parts = []
    for t in tokens:
        tl = t.lower()
        if tl in ("and",):
            continue
        if tl in ("co", "company"):
            parts.append(r"(?:co|company)\b")
        else:
            parts.append(re.escape(tl))
    if not parts:
        return None
    return re.compile(r"[\s,.]*(?:&|and)?[\s,.]*".join(parts), re.I)


def adv_patterns(watched):
    pats = []
    for name in watched or []:
        rx = _firm_regex(name)
        if rx:
            pats.append((name.strip(), rx))
    return pats


def _caseno_key(s):
    t = re.sub(r"\s+", "", (s or "").upper())
    m = re.match(r"^([A-Z]{1,12})(?:\(L\)|L)?/(\d+)/(\d{4})$", t)
    if m:
        no = m.group(2).lstrip("0") or m.group(2)
        return m.group(1), no, m.group(3)
    n = re.search(r"(\d+)/(\d{4})", t)
    if n:
        no = n.group(1).lstrip("0") or n.group(1)
        return "", no, n.group(2)
    return None


def is_tracked(caseno, tracked):
    u = (caseno or "").upper().strip()
    if not u:
        return False
    listed = [(t or "").upper().strip() for t in (tracked or []) if t]
    if u in listed:
        return True
    a = _caseno_key(u)
    for t in listed:
        if t == u:
            return True
        b = _caseno_key(t)
        if a and b and a[1] == b[1] and a[2] == b[2]:
            if not a[0] or not b[0] or a[0] == b[0]:
                return True
    return False



def match_advocates(text, pats):
    return [name for name, rx in pats if rx.search(text)]


def parse_causelist_entries(text, pats):
    marks = []
    for m in LEAD_RE.finditer(text):
        marks.append((m.start(2), m.end(2), m.group(2), True, m.group(1)))
    seen_pos = {mk[0] for mk in marks}
    for m in CONN_RE.finditer(text):
        if m.start(1) not in seen_pos:
            marks.append((m.start(1), m.end(1), m.group(1), False, None))
    marks.sort(key=lambda x: x[0])
    starts = [mk[0] for mk in marks]
    entries = []
    cur_serial, cur_caption = "", ""
    by_serial = {}
    for idx, (s_pos, e_pos, caseno, is_lead, serial) in enumerate(marks):
        seg_end = starts[idx + 1] if idx + 1 < len(starts) else len(text)
        seg = text[e_pos:seg_end]
        if is_lead:
            cur_serial = serial
            pre = text[max(0, s_pos - 240) : s_pos]
            caps = list(
                re.finditer(
                    r"(?i)((?:[A-Z]{2,}-)?FOR\s+[A-Z][A-Za-z0-9 ,/&()\-]{0,55})",
                    pre,
                )
            )
            if caps:
                cur_caption = re.sub(r"\s+\d+$", "", clean(caps[-1].group(1))).strip()
        blob = re.split(r"\bREMARK", seg, maxsplit=1, flags=re.I)[0]
        blob = re.sub(r"\[[^\]]*\]", " ", blob)
        for _n, _rx in pats:
            blob = _rx.sub(" ", blob)
        blob = clean(blob)
        mvs = re.search(r"\bV[S/]\.?\b", blob, re.I)
        if mvs:
            parties = (
                short(blob[: mvs.start()].strip(), 55)
                + " v "
                + short(blob[mvs.end() :].strip(), 55)
            ).strip(" v")
        else:
            parties = short(blob, 90)
        e = {
            "serial": cur_serial,
            "caseno": caseno,
            "caption": cur_caption,
            "parties": parties,
            "advocates": match_advocates(seg, pats),
            "connected": "",
            "folded": False,
        }
        entries.append(e)
        by_serial.setdefault(cur_serial, []).append(e)

    def _interloc(cn):
        mm = re.match(r"([A-Z]+)", cn)
        ab = mm.group(1) if mm else ""
        return ab == "IA" or ab.startswith("NM")

    for serial, group in by_serial.items():
        nums = [g["caseno"] for g in group]
        has_substantive = any(not _interloc(g["caseno"]) for g in group)
        for g in group:
            g["connected"] = ", ".join(n for n in nums if n != g["caseno"])
            g["folded"] = _interloc(g["caseno"]) and has_substantive
    return entries


def _causelist_session(date_ddmm):
    opener = make_opener()
    page_url = SITE + "/bhc/causelistFinal"
    with opener.open(urllib.request.Request(page_url), timeout=30) as r:
        page = r.read().decode("utf-8", "replace")
    body = urllib.parse.urlencode(
        {
            "_token": extract_input_value(page, "_token"),
            "form_secret": extract_input_value(page, "form_secret"),
            "chkpassphrase": extract_input_value(page, "chkpassphrase"),
            "m_juris": extract_input_value(page, "m_juris") or "B",
            "m_causedt": date_ddmm,
        }
    ).encode()
    req = urllib.request.Request(SITE + "/bhc/causelist/get-data", data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
    req.add_header("X-Requested-With", "XMLHttpRequest")
    req.add_header("Referer", page_url)
    with opener.open(req, timeout=60) as r:
        j = json.loads(r.read().decode("utf-8", "replace"))
    if not j.get("status") or not j.get("page"):
        return opener, []
    return opener, parse_causelist_judges(j["page"])


def list_causelist_day(date_ddmm):
    _opener, judges = _causelist_session(date_ddmm)
    return judges


def scan_causelist_pdfs(items, watched, tracked, opener=None):
    pats = adv_patterns(watched)
    tracked_list = list(tracked or [])
    if opener is None:
        opener = make_opener()
        try:
            opener.open(urllib.request.Request(SITE + "/bhc/causelistFinal"), timeout=30)
        except Exception:
            pass

    def one(item):
        try:
            href = abs_url(item.get("href") or "")
            req = urllib.request.Request(
                href, headers={"X-Requested-With": "XMLHttpRequest"}
            )
            with opener.open(req, timeout=60) as r:
                data = r.read()
            if data[:5] != b"%PDF-":
                return []
            text = pdf_text(data)
            mc = re.search(r"COURT\s*NO[.\s]*?(\d+)", text, re.I)
            court = mc.group(1) if mc else ""
            entries = parse_causelist_entries(text, pats)
            folded_advs = {}
            for e in entries:
                if e.get("folded"):
                    bucket = folded_advs.setdefault(e["serial"], [])
                    for ad in e["advocates"]:
                        if ad not in bucket:
                            bucket.append(ad)
            out = []
            for e in entries:
                if e.get("folded"):
                    continue
                advs = list(e["advocates"])
                for ad in folded_advs.get(e["serial"], []):
                    if ad not in advs:
                        advs.append(ad)
                mine = is_tracked(e["caseno"], tracked_list)
                if not mine and not advs:
                    continue
                out.append(
                    {
                        "serial": e["serial"],
                        "caseno": e["caseno"],
                        "caption": e["caption"],
                        "parties": e["parties"],
                        "connected": e["connected"],
                        "advocates": advs,
                        "judge": item.get("judge") or "",
                        "list_type": item.get("list_type") or "",
                        "court": court,
                    }
                )
            return out
        except Exception:
            return []


    hits = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        for batch in ex.map(one, items or []):
            hits.extend(batch)
    return hits


def scan_bhc_day(date_ddmm, watched, tracked):
    opener, judges = _causelist_session(date_ddmm)
    items = [
        {"href": link["href"], "judge": jd["judge"], "list_type": link["label"]}
        for jd in judges
        for link in jd["links"]
    ]
    if not items:
        return {"judges": 0, "hits": []}
    hits = scan_causelist_pdfs(items, watched, tracked, opener=opener)
    return {"judges": len(judges), "hits": hits}


def fetch_causelist_pdf(date_ddmm, judge, list_type):
    opener, judges = _causelist_session(date_ddmm)
    jl = (judge or "").strip().lower()
    tl = (list_type or "").strip().lower()
    for jd in judges:
        if jd["judge"].strip().lower() != jl:
            continue
        link = next(
            (l for l in jd["links"] if l["label"].strip().lower() == tl),
            jd["links"][0] if jd["links"] else None,
        )
        if not link:
            continue
        data = download_pdf_bytes(
            opener, link["href"], SITE + "/bhc/causelistFinal"
        )
        if not data:
            return None
        fn = sanitize("Causelist %s %s %s" % (list_type, judge, date_ddmm), 110) + ".pdf"
        return {"filename": fn, "base64": base64.b64encode(data).decode("ascii")}
    return None


def resolve_bhc_listing(add):
    abbr = (add.get("abbr") or "").upper()
    stampreg = add.get("stampreg") or "R"
    no, yr = add.get("no"), add.get("year")
    if not abbr or not no or not yr:
        raise RuntimeError("Could not read the case number.")
    last_err = None
    for side in ("2", "1"):
        matches = [
            t
            for t in get_case_types(side)
            if t["label"].split(" - ")[0].strip().upper() == abbr
        ]
        matches.sort(key=lambda t: (len(t["label"]), t["label"]))
        for match in matches:
            params = {
                "forum": "bhc",
                "side": side,
                "stampreg": stampreg,
                "case_type": match["value"],
                "case_no": str(no),
                "year": str(yr),
            }
            try:
                result = search_case(params)
                return {
                    "params": params,
                    "type_name": match["label"],
                    "lookup": to_lookup(result),
                }
            except Exception as e:
                last_err = e
                continue
    raise RuntimeError(
        str(last_err)
        if last_err
        else "Couldn't resolve case type '%s'. Add it from court with the type picker." % abbr
    )
