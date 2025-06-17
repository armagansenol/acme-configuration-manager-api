import swaggerJSDoc from "swagger-jsdoc"

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "ACME Configuration Manager API",
    version: "1.0.0",
    description: "API for managing configurations for ACME applications.",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Development server",
    },
    {
      url: "https://acme-configuration-manager-api.onrender.com",
      description: "Production server",
    },
  ],
}

const options = {
  swaggerDefinition,
  // Paths to files containing OpenAPI definitions
  apis: ["./src/routes/*.ts", "./src/types/*.ts"], // Adjust this path
}

const swaggerSpec = swaggerJSDoc(options)

export default swaggerSpec
