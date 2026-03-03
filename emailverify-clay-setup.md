# emailverify.io → Clay HTTP API Setup

This guide configures Clay's **HTTP API** block to find work emails using the
[emailverify.io Finder endpoint](https://emailverify.io).

---

## Clay HTTP API Block Configuration

### Basic Settings

| Field   | Value                                          |
|---------|------------------------------------------------|
| Method  | `GET`                                          |
| URL     | `https://app.emailverify.io/api/v1/finder`     |

### Query Parameters

Add the following key/value pairs under **Query Params**:

| Key      | Value                          | Notes                          |
|----------|--------------------------------|--------------------------------|
| `key`    | `YOUR_EMAILVERIFY_API_KEY`     | Paste your API key here        |
| `name`   | `{{First Name}} {{Last Name}}` | Clay column references         |
| `domain` | `{{Company Domain}}`           | Clay column reference          |

> **Tip:** You can also split the name into `first_name` and `last_name`
> parameters if your Clay table has separate columns for each.

### Only Run If (Conditional)

Set the **Only run if** field to ensure the block only fires when the required
data is present:

```
{{Company Domain}}
```

This skips rows where `Company Domain` is empty, saving API credits.

---

## Mapping the Response

After a successful call the API returns JSON like:

```json
{
  "status": "found",
  "email": "john.doe@example.com",
  "score": 95,
  "format": "{first}.{last}"
}
```

Map these fields to Clay columns:

| Clay Column        | Response Path   |
|--------------------|-----------------|
| Work Email         | `email`         |
| Email Score        | `score`         |
| Email Format       | `format`        |
| Email Finder Status| `status`        |

---

## Required Clay Table Columns

Your table should have at minimum:

- `First Name` — contact's first name
- `Last Name` — contact's last name
- `Company Domain` — e.g. `example.com` (not the full URL)

---

## Getting Your API Key

1. Log in at [https://app.emailverify.io](https://app.emailverify.io)
2. Go to **Settings → API**
3. Copy your API key and paste it into the `key` query parameter above

---

## Notes

- The `domain` field should be a bare domain (`example.com`), not a full URL
  (`https://www.example.com`). Strip the protocol/www before passing to Clay.
- Requests return `"status": "not_found"` when no email is located — filter
  these out with a downstream Clay formula or filter step.
- emailverify.io deducts one credit per successful finder lookup.
