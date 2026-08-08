# Contract: Project Issue Sources

## Read source configuration

`GET /api/projects/:slug/issue-sources`

Returns:

- GitHub derived source with Project repository connection/external ID and live availability.
- Linear source as `null` or exact connection + Linear Team external ID and live display/availability.

## Configure Linear source

`PUT /api/projects/:slug/issue-sources/linear`

```json
{
  "connectionId": "uuid",
  "linearTeamExternalId": "provider-id"
}
```

Server verifies Project and connection belong to active Mystra Team, connection is active/ready Linear API-key, and exact Team remains accessible. Owner/Admin only. Upsert is idempotent for same scope and atomic for replacement.

## Remove Linear source

`DELETE /api/projects/:slug/issue-sources/linear`

Owner/Admin only. Removes only Linear association and never changes Project repository/GitHub source.

## Failure rules

- no fallback to another connection, Team or `LINEAR_API_KEY`.
- missing/revoked external Team preserves stored external ID for diagnosis until operator replaces/removes it.
- archived/inaccessible Project fails closed.
- Member mutation returns authorization failure without upstream Linear request.
