import swaggerJSDoc from "swagger-jsdoc";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "REST API Documentation",
      version: "1.0.0",
      description: "Comprehensive RESTful API documentation with Node.js, Express, MongoDB Mongoose, and Swagger",
      contact: {
        name: "API Support",
        email: "support@example.com",
      },
    },
    servers: [
      {
        url: "http://localhost:5000/api/v1",
        description: "Development Server (v1)",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your Bearer token in the format: Bearer <JWT-token>",
        },
      },
      schemas: {
        Permission: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example: "66b3f23a9d8c7a1234567895",
            },
            permissionId: {
              type: "string",
              example: "PERM_USER_READ",
              description: "Unique permission identifier code",
            },
            name: {
              type: "string",
              example: "Read Users",
            },
            module: {
              type: "string",
              example: "Users",
            },
            action: {
              type: "string",
              enum: ["create", "read", "update", "delete", "manage", "export"],
              example: "read",
            },
            description: {
              type: "string",
              example: "View user accounts",
            },
            is_active: {
              type: "boolean",
              example: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        PermissionInput: {
          type: "object",
          required: ["permissionId", "name", "module"],
          properties: {
            permissionId: {
              type: "string",
              example: "PERM_BILLING_MANAGE",
            },
            name: {
              type: "string",
              example: "Manage Billing",
            },
            module: {
              type: "string",
              example: "Billing",
            },
            action: {
              type: "string",
              enum: ["create", "read", "update", "delete", "manage", "export"],
              example: "manage",
            },
            description: {
              type: "string",
              example: "Manage billing invoices and payments",
            },
            is_active: {
              type: "boolean",
              default: true,
            },
          },
        },
        Role: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example: "66b3f23a9d8c7a1234567891",
            },
            roleId: {
              type: "string",
              example: "ROL_1",
              description: "Unique role code identifier",
            },
            name: {
              type: "string",
              example: "SuperAdmin",
              description: "Name of the role",
            },
            description: {
              type: "string",
              example: "Super Administrator with full access",
            },
            permissions: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Permission",
              },
            },
            is_active: {
              type: "boolean",
              example: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        RoleInput: {
          type: "object",
          required: ["roleId", "name"],
          properties: {
            roleId: {
              type: "string",
              example: "ROL_6",
            },
            name: {
              type: "string",
              example: "Supervisor",
            },
            description: {
              type: "string",
              example: "Field Supervisor Role",
            },
            is_active: {
              type: "boolean",
              default: true,
            },
          },
        },
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example: "66b3f23a9d8c7a1234567890",
              description: "MongoDB unique object identifier",
            },
            name: {
              type: "string",
              example: "Jane Doe",
              description: "Full name of the user",
            },
            email: {
              type: "string",
              format: "email",
              example: "jane.doe@example.com",
              description: "Email address",
            },
            phonenumber: {
              type: "string",
              example: "+919876543210",
              description: "Primary contact phone number",
            },
            whatsappnumber: {
              type: "string",
              example: "+919876543210",
              description: "WhatsApp contact number",
            },
            district: {
              type: "string",
              example: "66b3f23a9d8c7a1234567899",
              description: "Referenced District ObjectId",
            },
            localbodytype: {
              type: "string",
              enum: ["panjayath", "municipalaty"],
              example: "panjayath",
            },
            localbody: {
              type: "string",
              example: "Kottayam Local Body",
            },
            wardNo: {
              type: "string",
              example: "04",
            },
            houseNo: {
              type: "string",
              example: "12/A",
            },
            address: {
              type: "string",
              example: "123 Green Street, District Park",
            },
            is_active: {
              type: "boolean",
              example: true,
            },
            userId: {
              type: "string",
              example: "USR-2026-001",
            },
            wallet: {
              type: "string",
              example: "150.00",
            },
            cordinates: {
              type: "object",
              properties: {
                latitude: {
                  type: "number",
                  example: 9.5916,
                },
                longitude: {
                  type: "number",
                  example: 76.5222,
                },
              },
            },
            role: {
              type: "string",
              example: "ROL_1",
              description: "RoleId or Role ObjectId reference",
            },
            pincode: {
              type: "string",
              example: "686001",
            },
            qrcode_url: {
              type: "string",
              example: "https://example.com/qrcodes/usr_001.png",
            },
            vehicleno: {
              type: "string",
              example: "KL-01-AB-1234",
            },
            adharno: {
              type: "string",
              example: "1234 5678 9012",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2026-08-07T12:00:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              example: "2026-08-07T12:00:00.000Z",
            },
          },
        },
        UserInput: {
          type: "object",
          required: ["name", "phonenumber"],
          properties: {
            name: {
              type: "string",
              example: "Jane Doe",
            },
            phonenumber: {
              type: "string",
              example: "+919876543210",
            },
            email: {
              type: "string",
              format: "email",
              example: "jane.doe@example.com",
            },
            whatsappnumber: {
              type: "string",
              example: "+919876543210",
            },
            district: {
              type: "string",
              example: "66b3f23a9d8c7a1234567899",
            },
            localbodytype: {
              type: "string",
              enum: ["panjayath", "municipalaty"],
              example: "panjayath",
            },
            localbody: {
              type: "string",
              example: "Kottayam Local Body",
            },
            wardNo: {
              type: "string",
              example: "04",
            },
            houseNo: {
              type: "string",
              example: "12/A",
            },
            address: {
              type: "string",
              example: "123 Green Street, District Park",
            },
            is_active: {
              type: "boolean",
              default: true,
            },
            userId: {
              type: "string",
              example: "USR-2026-001",
            },
            wallet: {
              type: "string",
              example: "150.00",
            },
            cordinates: {
              type: "object",
              properties: {
                latitude: {
                  type: "number",
                  example: 9.5916,
                },
                longitude: {
                  type: "number",
                  example: 76.5222,
                },
              },
            },
            role: {
              type: "string",
              example: "ROL_1",
            },
            pincode: {
              type: "string",
              example: "686001",
            },
            qrcode_url: {
              type: "string",
              example: "https://example.com/qrcodes/usr_001.png",
            },
            vehicleno: {
              type: "string",
              example: "KL-01-AB-1234",
            },
            adharno: {
              type: "string",
              example: "1234 5678 9012",
            },
          },
        },
        ApiResponse: {
          type: "object",
          properties: {
            statusCode: {
              type: "integer",
              example: 200,
            },
            success: {
              type: "boolean",
              example: true,
            },
            message: {
              type: "string",
              example: "Operation performed successfully",
            },
            data: {
              type: "object",
            },
          },
        },
        ApiError: {
          type: "object",
          properties: {
            statusCode: {
              type: "integer",
              example: 400,
            },
            success: {
              type: "boolean",
              example: false,
            },
            message: {
              type: "string",
              example: "Error message description",
            },
            errors: {
              type: "array",
              items: {
                type: "string",
              },
            },
          },
        },
      },
    },
  },
  apis: [path.join(__dirname, "../routes/*.js").replace(/\\/g, "/")],
};

export const swaggerSpec = swaggerJSDoc(swaggerOptions);
