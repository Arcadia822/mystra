# Contract: Linear API-key Connections

## Public routes

- `POST /api/integration-connections/linear/api-key`
- `PUT /api/integration-connections/linear/api-key/:id`
- `DELETE /api/integration-connections/linear/api-key/:id`
- `GET /api/integration-connections/linear/api-key/:id/teams?first=&after=`

Create/replace body:

```json
{ "apiKey": "secret input only", "displayName": "optional" }
```

Public response uses existing `IntegrationConnection` and never includes `apiKey`, token, `credentialRef`, fingerprint or GraphQL request body.

## Authorization

- session determines active Mystra Team.
- Owner/Admin: create, replace, delete and list accessible Linear Teams.
- Member: may see public connection summaries but cannot mutate credentials or use connection discovery outside Project read policy.

## Validation

Before persistence, the service verifies viewer/workspace identity, accessible Teams and Issue read capability. GraphQL `errors`, invalid data, timeout, 401/403 and 429 map to stable Integration errors.

Replace validates and seals a new version before atomically switching the connection reference. Failure leaves prior metadata and credential untouched.

Delete returns conflict when any `ProjectIssueSource.connectionId` references the connection.
