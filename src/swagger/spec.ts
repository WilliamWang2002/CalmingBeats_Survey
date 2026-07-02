export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "CalmingBeats Survey API",
    version: "0.1.0"
  },
  paths: {
    "/start": {
      get: {
        summary: "Email/code session entrypoint"
      },
      post: {
        summary: "Email/code session entrypoint"
      }
    },
    "/api/launch-code": {
      post: {
        summary: "Create one-time launch code for email links"
      }
    },
    "/api/tracker": {
      post: {
        summary: "Create tracker session"
      }
    },
    "/api/survey": {
      post: {
        summary: "Submit survey answers and timing"
      }
    },
    "/api/survey-result": {
      get: {
        summary: "Read recent survey results"
      }
    },
    "/api/docs": {
      get: {
        summary: "Get OpenAPI spec"
      }
    }
  }
};
