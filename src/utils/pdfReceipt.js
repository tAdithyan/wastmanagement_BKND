const escapePdf = (value) => String(value ?? "").replace(/([\\()])/g, "\\$1");

export const createPickupReceiptPdf = (pickup) => {
  const customer = pickup.customerId || {};
  const operator = pickup.operatorId || {};
  const completedAt = pickup.updatedAt ? new Date(pickup.updatedAt).toLocaleString("en-IN") : "Not available";
  const weight = Number(pickup.weight || 0);
  const amount = Number(pickup.amount || 0);
  const pricePerKg = weight > 0 ? amount / weight : 0;
  const lines = [
    ["CLEANLOOP", 20, true],
    ["Waste Collection Receipt", 16, true],
    ["", 10],
    [`Receipt / Pickup ID: ${pickup.pickupId || pickup._id}`, 11],
    [`Completed: ${completedAt}`, 11],
    ["", 10],
    [`Customer: ${customer.name || "Not available"}`, 11],
    [`Customer phone: ${customer.phonenumber || "Not available"}`, 11],
    [`Collection agent: ${operator.name || "Not available"}`, 11],
    ["", 10],
    [`Waste category: ${pickup.wasteType}`, 11],
    [`Collected weight: ${weight.toFixed(2)} kg`, 11],
    [`Price per kg: INR ${pricePerKg.toFixed(2)}`, 11],
    [`Total charged: INR ${amount.toFixed(2)}`, 14, true],
    ["", 10],
    ["Payment method: Customer wallet", 11],
    ["Status: PAID / COLLECTION COMPLETED", 11, true],
    ["", 10],
    ["Thank you for using CleanLoop.", 10],
  ];

  let y = 790;
  const content = lines.map(([line, size, bold]) => {
    const command = `BT /${bold ? "F2" : "F1"} ${size} Tf 55 ${y} Td (${escapePdf(line)}) Tj ET`;
    y -= Number(size) + 10;
    return command;
  }).join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
};
