---
title: '[API NAME] Reference'
version: 'v1.0'
status: 'Stable'
---

## 1. Overview & Authentication

- **Base URL**: `https://api.example.com/v1`
- **Authentication**: Bearer Token in `Authorization` header

## 2. Common Response Envelope

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

## 3. Endpoints

### GET /resources

Retrieve a paginated list of resources.

**Request Query Parameters**:
- `limit` (integer, optional): Default `20`.
- `cursor` (string, optional): Pagination pointer.

**Response (200 OK)**:
```json
{
  "code": 0,
  "data": {
    "items": [],
    "next_cursor": null
  }
}
```

### POST /resources

Create a new resource.

**Request Body**:
```json
{
  "name": "string",
  "enabled": true
}
```
