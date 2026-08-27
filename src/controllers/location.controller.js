import PRI from "../models/PRI.js";
import District from "../models/District.js";
import URB from "../models/Urban.js";
// GET /api/pris  — optional ?code= and/or ?q=
export const getPRIs = async (req, res, next) => {
  try {
    const { q, code } = req.query;
    const filter = {};
    if (code) filter.districtCode = Number(code);
    if (q) filter.localbodyname = { $regex: q, $options: "i" };
    const pris = await PRI.find(filter, { priId: 1, localbodyname: 1, districtCode: 1, _id: 0 }).sort({ localbodyname: 1 });
    res.json(pris);
  } catch (err) {
    next(err);
  }
};

// GET /api/pris/:code  — also supports ?q= for name search
export const getPRIsByDistrict = async (req, res, next) => {
  try {
    const q = req.query.q;
    const filter = q
      ? { districtCode: Number(req.params.code), localbodyname: { $regex: q, $options: "i" } }
      : { districtCode: Number(req.params.code) };

    const pris = await PRI.find(filter, { priId: 1, localbodyname: 1, districtCode: 1, _id: 0 }).sort({ localbodyname: 1 });
    if (!pris.length) return res.status(404).json({ message: "No PRIs found for this district code" });
    res.json(pris);
  } catch (err) {
    next(err);
  }
};



// GET /api/urbans  — optional ?code= and/or ?q=
export const getURBs = async (req, res, next) => {
  try {
    const { q, code } = req.query;
    const filter = {};
    if (code) filter.districtCode = Number(code);
    if (q) filter.localbodyname = { $regex: q, $options: "i" };
    const urbs = await URB.find(filter, { urbId: 1, localbodyname: 1, districtCode: 1, _id: 0 }).sort({ localbodyname: 1 });
    res.json(urbs);
  } catch (err) {
    next(err);
  }
};

// GET /api/urbans/:code  — also supports ?q= for name search
export const getURBsByDistrict = async (req, res, next) => {
  try {
    const q = req.query.q;
    const filter = q
      ? { districtCode: Number(req.params.code), localbodyname: { $regex: q, $options: "i" } }
      : { districtCode: Number(req.params.code) };

    const urbs = await URB.find(filter, { urbId: 1, localbodyname: 1, districtCode: 1, _id: 0 }).sort({ localbodyname: 1 });
    if (!urbs.length) return res.status(404).json({ message: "No urban local bodies found for this district code" });
    res.json(urbs);
  } catch (err) {
    next(err);
  }
};




// GET /api/districts  — optional ?q= to search by name, omit for all
export const getDistricts = async (req, res, next) => {
  try {
    const q = req.query.q;
    const filter = q ? { districtName: { $regex: q, $options: "i" } } : {};
    const districts = await District.find(filter, { districtCode: 1, districtName: 1 }).sort({ districtCode: 1 });
    res.json(districts);
  } catch (err) {
    next(err);
  }
};

// GET /api/districts/:code  — also supports ?q= for name search
export const getDistrictByCode = async (req, res, next) => {
  try {
    const q = req.query.q;
    if (q !== undefined) {
      const districts = await District.find(
        { districtName: { $regex: q, $options: "i" } },
        { districtCode: 1, districtName: 1 }
      ).sort({ districtName: 1 });
      return res.json(districts);
    }
    const district = await District.findOne({ districtCode: req.params.code }, { districtCode: 1, districtName: 1 });
    if (!district) return res.status(404).json({ message: "District not found" });
    res.json(district);
  } catch (err) {
    next(err);
  }
};

