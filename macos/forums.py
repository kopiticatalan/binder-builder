"""SAT and NCLT lookups for the Mac app. Stdlib only."""
import html, json, re, ssl, urllib.parse, urllib.request, http.cookiejar, zlib
from concurrent.futures import ThreadPoolExecutor

SAT = "https://satweb.sat.gov.in"
NCLT = "https://nclt.gov.in"
EFILE = "https://efiling.nclt.gov.in"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.4 Safari/605.1.15")

SAT_TYPES = [
    {"value": "1", "label": "SEBI"},
    {"value": "2", "label": "IRDAI"},
    {"value": "3", "label": "PFRDA"},
]
NCLT_BENCHES = [
    {"value": "9", "label": "Mumbai"},
    {"value": "10", "label": "New Delhi / Principal"},
    {"value": "5", "label": "Chennai"},
    {"value": "8", "label": "Kolkata"},
    {"value": "1", "label": "Ahmedabad"},
    {"value": "3", "label": "Bengaluru"},
    {"value": "7", "label": "Hyderabad"},
    {"value": "4", "label": "Chandigarh"},
    {"value": "2", "label": "Allahabad"},
    {"value": "6", "label": "Guwahati"},
    {"value": "11", "label": "Jaipur"},
    {"value": "12", "label": "Amaravati"},
    {"value": "13", "label": "Cuttack"},
    {"value": "14", "label": "Kochi"},
    {"value": "15", "label": "Indore"},
]
NCLT_TYPES = [
    {"value": "16", "label": "Company Petition IB (IBC)"},
    {"value": "2", "label": "Company Petition (Companies Act)"},
    {"value": "15", "label": "CP(AA) Merger & Amalgamation"},
    {"value": "14", "label": "CA(A) Merger & Amalgamation"},
    {"value": "13", "label": "Company Application (Companies Act)"},
    {"value": "18", "label": "Company Application (IBC)"},
    {"value": "20", "label": "Interlocutory Application (IBC)"},
    {"value": "4", "label": "Interlocutory Application (Companies Act)"},
]


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


def _clean(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


def _cells(row):
    return [_clean(c.replace("<br>", " | ").replace("<br/>", " | "))
            for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S | re.I)]


def _dmy(raw):
    s = re.sub(r"\s+", " ", raw or "").strip()
    m = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$", s)
    if m:
        y = m.group(3)
        if len(y) == 2:
            y = "20" + y
        return "%s/%s/%s" % (m.group(1).zfill(2), m.group(2).zfill(2), y)
    return s


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


def pdf_text(data):
    out = []
    i = 0
    while True:
        s = data.find(b"stream", i)
        if s < 0:
            break
        j = s + 6
        if data[j:j + 2] == b"\r\n":
            j += 2
        elif data[j:j + 1] in (b"\n", b"\r"):
            j += 1
        e = data.find(b"endstream", j)
        if e < 0:
            break
        raw = data[j:e]
        i = e + 9
        dec = _inflate(raw)
        if not dec or (b"Tj" not in dec and b"TJ" not in dec):
            continue
        try:
            s2 = dec.decode("latin1")
            res, k, L = [], 0, len(s2)
            while k < L:
                if s2[k] == "(":
                    j2, depth, buf = k + 1, 1, []
                    while j2 < L and depth:
                        d = s2[j2]
                        if d == "\\":
                            n = s2[j2 + 1] if j2 + 1 < L else ""
                            buf.append("\n" if n == "n" else (" " if n == "t" else n))
                            j2 += 2
                            continue
                        if d == "(":
                            depth += 1
                            buf.append(d)
                        elif d == ")":
                            depth -= 1
                            if depth:
                                buf.append(d)
                        else:
                            buf.append(d)
                        j2 += 1
                    res.append("".join(buf))
                    k = j2
                    continue
                k += 1
            out.append("".join(res))
        except Exception:
            pass
    return "".join(out).replace("\x00", "")


def _get(opener, url, referer=None):
    req = urllib.request.Request(url)
    if referer:
        req.add_header("Referer", referer)
    with opener.open(req, timeout=60) as r:
        return r.read()


def _token(html_s):
    m = re.search(r'id="security_token"\s+value="([^"]+)"', html_s, re.I)
    return m.group(1) if m else ""


def sat_post(opener, path, fields, referer):
    body = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(SAT + path, data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
    req.add_header("X-Requested-With", "XMLHttpRequest")
    req.add_header("Referer", referer)
    req.add_header("Origin", SAT)
    req.add_header("Accept", "application/json, text/javascript, */*; q=0.01")
    with opener.open(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def pad_sat(no):
    n = re.sub(r"\D", "", str(no or ""))
    return n if len(n) >= 4 else n.zfill(4)


def search_sat(params):
    case_no = pad_sat(params.get("case_no"))
    year = str(params.get("year") or "").strip()
    case_type = str(params.get("case_type") or "1")
    opener = make_opener()
    page = _get(opener, SAT + "/case-status").decode("utf-8", "replace")
    token = _token(page)
    if not token:
        raise RuntimeError("Could not open SAT case-status.")
    found = sat_post(opener, "/get-case-status", {
        "bench": "1", "case_type": case_type, "case_no": case_no,
        "filing_year": year, "token": token,
    }, SAT + "/case-status")
    content = found.get("content") or ""
    row = None
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", content, re.S | re.I):
        filing = re.search(r'data-id="(\d+)"', tr, re.I)
        cells = _cells(tr)
        if filing and len(cells) >= 6:
            vs = cells[4]
            parts = re.split(r"\s+vs\.?\s+", vs, flags=re.I)
            row = {
                "filing_no": filing.group(1),
                "lodging": cells[2],
                "appeal_no": cells[3],
                "petitioner": (parts[0] if parts else vs).strip(),
                "respondent": parts[1].strip() if len(parts) > 1 else "",
                "filed_on": _dmy(cells[5]),
                "status": cells[6] if len(cells) > 6 else "",
            }
            break
    if not row:
        raise RuntimeError("No SAT appeal found. Check type, number and year.")
    pet, resp, next_list, last_list, last_coram = (
        row["petitioner"], row["respondent"], "", "", "")
    if row["filing_no"] and found.get("token"):
        hist = sat_post(opener, "/get-case-history", {
            "filing_no": row["filing_no"], "token": found["token"],
        }, SAT + "/case-status")
        h = hist.get("content") or ""
        def table_after(heading):
            m = re.search(r"<h3[^>]*>\s*" + heading, h, re.I)
            if not m:
                return []
            sl = h[m.start():]
            st, en = sl.lower().find("<table"), sl.lower().find("</table>")
            if st < 0 or en < 0:
                return []
            tb = sl[st:en]
            tbod = re.search(r"<tbody[\s\S]*?<tr[^>]*>([\s\S]*?)</tr>", tb, re.I)
            return _cells(tbod.group(1) if tbod else "")
        party, nxt, histc = table_after("Party"), table_after("Next date of Listing"), table_after("Case Listing History")
        if party:
            pet, resp = party[0] or pet, (party[1] if len(party) > 1 else resp)
        if nxt and not re.search(r"no record", nxt[0], re.I):
            next_list = _dmy(nxt[0])
        if histc:
            last_list = _dmy(histc[0])
            last_coram = histc[2] if len(histc) > 2 else ""
    orders = []
    opage = _get(opener, SAT + "/orders").decode("utf-8", "replace")
    otok = _token(opage)
    if otok:
        listed = sat_post(opener, "/get-orders-by-case", {
            "bench": "1", "case_type": case_type, "case_no": case_no,
            "filing_year": year, "security_token": otok,
        }, SAT + "/orders")
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", listed.get("content") or "", re.S | re.I):
            href = re.search(r'href="(https?://satweb\.sat\.gov\.in/view-order/[^"]+)"', tr, re.I)
            if not href:
                continue
            cells = _cells(tr)
            date = _dmy(cells[5] if len(cells) > 5 else next((c for c in cells if re.search(r"\d{2}[/-]\d{2}[/-]\d{2,4}", c)), ""))
            orders.append({"srl": cells[0] if cells else "", "date": date,
                           "doc": cells[2] if len(cells) > 2 else "Order",
                           "coram": cells[4] if len(cells) > 4 else "",
                           "href": html.unescape(href.group(1))})
    kind = next((t["label"] for t in SAT_TYPES if t["value"] == case_type), "SEBI")
    return {
        "opener": opener,
        "petitioner": pet, "respondent": resp, "orders": orders,
        "meta": {
            "cnr": row["filing_no"], "filed_on": row["filed_on"],
            "next_listing": next_list, "lodging": row.get("lodging") or "",
            "last_listing": last_list, "last_coram": last_coram,
            "status": row.get("status") or "",
            "type_name": kind,
        },
    }


def nclt_json(opener, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        EFILE + path, data=data, method="POST" if body is not None else "GET")
    req.add_header("Accept", "application/json, text/javascript, */*; q=0.01")
    req.add_header("X-Requested-With", "XMLHttpRequest")
    req.add_header("Referer", EFILE + "/casehistorybeforeloginmenutrue.drt")
    req.add_header("Origin", EFILE)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    with opener.open(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def search_nclt(params):
    case_no = re.sub(r"\D", "", str(params.get("case_no") or ""))
    year = str(params.get("year") or "").strip()
    bench = str(params.get("bench") or "9")
    case_type = str(params.get("case_type") or "16")
    opener = make_opener()
    _get(opener, EFILE + "/casehistorybeforeloginmenutrue.drt")
    bean = {
        "wayofselection": "casenumber", "i_bench_id": "0", "filing_no": "",
        "i_bench_id_case_no": bench, "i_case_type_caseno": case_type,
        "i_case_year_caseno": year, "case_no": case_no,
        "i_party_search": "", "i_bench_id_party": "0", "party_type_party": "0",
        "party_name_party": "", "i_case_year_party": "0", "status_party": "0",
        "i_adv_search": "", "i_bench_id_lawyer": "0", "party_lawer_name": "",
        "i_case_year_lawyer": "0", "bar_council_advocate": "",
    }
    found = nclt_json(opener, "/caseHistoryoptional.drt", bean)
    rows = found.get("mainpanellist") or []
    if not rows or not rows[0].get("filing_no"):
        raise RuntimeError("No NCLT matter found. Check bench, type, number and year.")
    row = rows[0]
    det = nclt_json(opener, "/caseHistoryalldetails.drt?filing_no=%s&flagIA=false"
                    % urllib.parse.quote(row["filing_no"]))
    procs = [p for p in (det.get("allproceedingdtls") or []) if p.get("encPath")][:40]
    orders = []
    for i, p in enumerate(procs):
        date = _dmy(p.get("listing_date") or p.get("order_upload_date") or "")
        enc = p.get("encPath") or ""
        href = EFILE + "/ordersview.drt?path=" + urllib.parse.quote(enc, safe="")
        orders.append({
            "srl": str(i + 1), "date": date,
            "doc": p.get("path_descr") or p.get("purpose") or "Order",
            "coram": " · ".join(x for x in [p.get("bench_location_name"),
                                            ("Court " + p["court_no"]) if p.get("court_no") else ""] if x),
            "href": href,
        })
    bench_lbl = next((b["label"] for b in NCLT_BENCHES if b["value"] == bench), "Mumbai")
    type_lbl = next((t["label"] for t in NCLT_TYPES if t["value"] == case_type), "NCLT")
    return {
        "opener": opener,
        "petitioner": row.get("case_title1") or "",
        "respondent": row.get("case_title2") or "",
        "orders": orders,
        "meta": {
            "cnr": row.get("filing_no") or "",
            "filed_on": _dmy(row.get("date_of_filing") or ""),
            "next_listing": _dmy("" if row.get("next_list_date") in (None, "NA") else row.get("next_list_date") or ""),
            "lodging": row.get("case_no") or "",
            "status": row.get("status") or row.get("action_type") or "",
            "type_name": type_lbl,
            "bench_label": bench_lbl,
        },
    }


def scan_sat(dates, tracked, watched):
    """dates: list of dd-mm-yyyy. tracked/watched: strings."""
    opener = make_opener()
    page = _get(opener, SAT + "/causelist").decode("utf-8", "replace")
    token = _token(page)
    if not token or not dates:
        return []
    dates = sorted(dates)
    listed = sat_post(opener, "/get-causelist", {
        "startDate": dates[0], "endDate": dates[-1], "token": token,
    }, SAT + "/causelist")
    index = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", listed.get("content") or "", re.S | re.I):
        href = re.search(r'href="(https?://satweb\.sat\.gov\.in/view-causelist/[^"]+)"', tr, re.I)
        if not href:
            continue
        cells = _cells(tr)
        index.append({"date": _dmy(cells[1] if len(cells) > 1 else ""), "href": href.group(1)})
    wanted = set()
    for d in dates:
        m = re.match(r"(\d{2})-(\d{2})-(\d{4})", d)
        if m:
            wanted.add("%s%s%s" % (m.group(3), m.group(2), m.group(1)))
    track_u = [t.upper() for t in tracked]
    watch_l = [w.lower() for w in watched if w.strip()]
    hits = []
    for day in index:
        key = re.sub(r"\D", "", _dmy(day["date"]))
        if wanted and key not in wanted and len(key) == 8:
            # dmy 21/08/2026 -> 21082026 vs wanted 20260821. normalize:
            dm = re.match(r"(\d{2})/(\d{2})/(\d{4})", _dmy(day["date"]))
            iso = (dm.group(3) + dm.group(2) + dm.group(1)) if dm else key
            if iso not in wanted:
                continue
        try:
            html_s = _get(opener, day["href"], SAT + "/causelist").decode("utf-8", "replace")
        except Exception:
            continue
        purpose, court, judge = "Cause list", "1", ""
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", html_s, re.S | re.I):
            text = _clean(tr)
            pm = re.search(r"PURPOSE:\s*(.+)$", text, re.I)
            if pm:
                purpose = pm.group(1).strip()
                continue
            cm = re.search(r"COURT\s*NO\s*:?\s*(\d+)", text, re.I)
            if cm:
                court = cm.group(1)
            names = [ _clean(x) for x in re.findall(r"HON'BLE:\s*([^<]+)", tr, re.I)]
            if names:
                judge = " · ".join(names)
            cells = _cells(tr)
            if len(cells) < 5:
                continue
            appeal = re.search(r"Appeal\s*[-–]?\s*(\d{1,5})\s*/\s*(\d{4})", cells[1], re.I)
            if not appeal:
                continue
            tm = re.search(r"Main Matter:\s*(SEBI|IRDAI?|PFRDA)", cells[1], re.I)
            kind = (tm.group(1) if tm else "SEBI").replace("IRDA", "IRDAI") if tm and tm.group(1) == "IRDA" else (tm.group(1) if tm else "SEBI")
            no, year = pad_sat(appeal.group(1)), appeal.group(2)
            caseno = "%s/%s/%s" % (kind, no, year)
            parties = " v ".join(x for x in [cells[2], cells[4] if len(cells) > 4 else ""] if x)
            needle = ("%s/%s" % (no, year)).upper()
            mine = any(needle in t or caseno.upper() in t for t in track_u)
            blob = (parties + " " + " ".join(cells)).lower()
            advs = [w for w in watch_l if w in blob]
            if mine or advs:
                hits.append({
                    "caseno": caseno, "serial": cells[0], "parties": parties,
                    "court": court, "judge": judge, "list_type": "SAT · " + purpose,
                    "href": day["href"], "date": _dmy(day["date"]),
                    "type_name": kind, "no": no.lstrip("0") or no, "year": year,
                    "mine": mine, "advs": advs,
                    "add": {"forum": "sat", "abbr": kind, "stampreg": "R",
                            "no": no.lstrip("0") or no, "year": year},
                })
    return hits


def _court_to_bench(court):
    s = (court or "").lower()
    for name, bid in (("mumbai", "9"), ("delhi", "10"), ("principal", "10"),
                      ("chennai", "5"), ("kolkata", "8"), ("ahmedabad", "1"),
                      ("bengaluru", "3"), ("bangalore", "3"), ("hyderabad", "7"),
                      ("chandigarh", "4"), ("allahabad", "2"), ("guwahati", "6"),
                      ("jaipur", "11"), ("amaravati", "12"), ("cuttack", "13"),
                      ("kochi", "14"), ("indore", "15")):
        if name in s:
            return bid
    return ""


def scan_nclt(dates, tracked, watched, benches=None):
    benches = set(benches or ["9"])
    if not dates:
        return []
    dates = sorted(dates)
    def to_us(d):
        m = re.match(r"(\d{2})-(\d{2})-(\d{4})", d)
        return "%s/%s/%s" % (m.group(2), m.group(1), m.group(3)) if m else d
    start, end = to_us(dates[0]), to_us(dates[-1])
    opener = make_opener()
    index = []
    for page in range(6):
        url = (NCLT + "/all-cause-list?field_nclt_benches_list_target_id=All"
               + "&field_cause_date_value=" + urllib.parse.quote(start)
               + "&field_cause_date_value_1=" + urllib.parse.quote(end)
               + "&page=%d" % page)
        try:
            html_s = _get(opener, url).decode("utf-8", "replace")
        except Exception:
            break
        rows = []
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", html_s, re.S | re.I):
            href = re.search(r'href="(/sites/default/files/pdf_cause_list/[^"]+\.pdf)"', tr, re.I)
            if not href:
                continue
            cells = _cells(tr)
            court = cells[2] if len(cells) > 2 else ""
            b = _court_to_bench(court)
            if b and b not in benches:
                continue
            rows.append({
                "title": cells[1] if len(cells) > 1 else "",
                "court": court,
                "date": cells[4] if len(cells) > 4 else "",
                "href": NCLT + href.group(1),
            })
        if not rows:
            break
        index.extend(rows)
        if len(rows) < 20:
            break
    CASE_RE = re.compile(
        r"((?:C\.?\s*P\.?|C\.?\s*A\.?|I\.?\s*A\.?|CP|CA|IA|COMP\.?\s*APPL)"
        r"[^\n]{0,18}?\d{1,5}\s*(?:/|\()\s*(?:MB|IB|CAA|NCLT|[A-Z]{2,4})\)?\s*/?\s*\d{4})",
        re.I)
    track_u = [t.upper() for t in tracked]
    watch_l = [w.lower() for w in watched if w.strip()]
    hits = []

    def one(meta):
        try:
            data = _get(opener, meta["href"])
            if data[:5] != b"%PDF-":
                return []
            text = pdf_text(data).replace("en-US", " ")
            out = []
            seen = set()
            for m in CASE_RE.finditer(text):
                caseno = re.sub(r"\s+", " ", m.group(1)).strip().upper()
                if caseno in seen:
                    continue
                seen.add(caseno)
                around = text[max(0, m.start() - 40): m.start() + 280]
                vs = re.split(r"\bV/?s\b", around, flags=re.I)
                parties = ""
                if len(vs) > 1:
                    parties = (vs[0][-80:].strip() + " v " + vs[1][:80].strip())[:160]
                ym = re.search(r"(\d{4})\s*$", caseno)
                nm = re.search(r"(\d{1,5})", caseno)
                no, year = (nm.group(1) if nm else ""), (ym.group(1) if ym else "")
                mine = any(no and year and no in t and year in t for t in track_u)
                blob = (parties + " " + caseno).lower()
                advs = [w for w in watch_l if w in blob]
                if mine or advs:
                    out.append({
                        "caseno": caseno, "serial": str(len(out) + 1),
                        "parties": parties, "court": meta["court"],
                        "judge": meta["court"], "list_type": "NCLT · " + (meta["court"] or "Cause list"),
                        "href": meta["href"], "date": meta["date"],
                        "type_name": "Company Petition IB (IBC)" if "IB" in caseno else "NCLT",
                        "no": no, "year": year, "mine": mine, "advs": advs,
                        "add": {"forum": "nclt", "abbr": caseno, "stampreg": "R",
                                "no": no, "year": year, "bench": _court_to_bench(meta["court"]) or "9"},
                    })
            return out
        except Exception:
            return []

    with ThreadPoolExecutor(max_workers=4) as ex:
        for batch in ex.map(one, index[:40]):
            hits.extend(batch)
    return hits
