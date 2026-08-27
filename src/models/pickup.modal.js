import mongoose from "mongoose";

/* =========================
   COUNTER SCHEMA
========================= */

const counterSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },

    sequence: {
        type: Number,
        default: 0,
    },
});

const Counter =
    mongoose.models.Counter ||
    mongoose.model("Counter", counterSchema);


/* =========================
   PICKUP SCHEMA
========================= */

const pickupSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        operatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            index: true,
            default: null,
        },

        pickupId: {
            type: String,
            unique: true,
            index: true,
        },

        wasteType: {
            type: String,
            required: true,
            trim: true,
        },

        preferredDate: {
            type: Date,
            index: true,
        },

        weight: {
            type: Number,
            default: 0,
            min: 0,
        },

        pickupLocation: {
            type: {
                type: String,
                enum: ["Point"],
                default: "Point",
            },

            coordinates: {
                type: [Number], // [longitude, latitude]
                required: true,
            },
        },

        status: {
            type: String,

            enum: [
                "scheduled",
                "assigned",
                "on_the_way",
                "in_progress",
                "completed",
                "cancelled",
                "failed",
            ],

            default: "scheduled",
            index: true,
        },

        amount: {
            type: Number,
            default: 0,
            min: 0,
        },
        ratePerKg: { type: Number, default: null, min: 0 },
        recurringContractId: { type: mongoose.Schema.Types.ObjectId, ref: "RecurringPickup", default: null, index: true },
        recurringGenerationKey: { type: String, unique: true, sparse: true },
        paymentStatus: {
            type: String,
            enum: ["pending", "accrued", "invoiced", "paid", "overdue"],
            default: "pending",
            index: true,
        },
        monthlyInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "MonthlyInvoice", default: null, index: true },

        notes: {
            type: String,
            trim: true,
            default: "",
        },

        cancellationReason: {
            type: String,
            trim: true,
            default: null,
        },

        weighingMethod: {
            type: String,

            enum: [
                "manual",
                "bluetooth_scale",
            ],

            default: "manual",
        },

        scaleDeviceId: {
            type: String,
            default: null,
            trim: true,
        },
    },
    {
        timestamps: true,

        toJSON: {
            transform: (doc, ret) => {
                ret.id = ret._id.toString();

                delete ret._id;
                delete ret.__v;

                return ret;
            },
        },
    }
);


/* =========================
   GEO INDEX
========================= */

pickupSchema.index({
    pickupLocation: "2dsphere",
});


/* =========================
   AUTO GENERATE PICKUP ID
   COL-001
   COL-002
   COL-003
========================= */

pickupSchema.pre("save", async function () {

    // Do not generate again while updating pickup
    if (this.pickupId) {
        return;
    }

    const counter = await Counter.findOneAndUpdate(
        {
            name: "pickupId",
        },
        {
            $inc: {
                sequence: 1,
            },
        },
        {
            new: true,
            upsert: true,
        }
    );

    this.pickupId =
        `COL-${String(counter.sequence).padStart(3, "0")}`;
});


/* =========================
   MODEL
========================= */

const Pickup =
    mongoose.models.Pickup ||
    mongoose.model(
        "Pickup",
        pickupSchema
    );

export default Pickup;
