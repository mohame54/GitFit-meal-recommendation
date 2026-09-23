# Frontend guide — Meals Personalization API

How a client app calls this API. Interactive docs (try requests in the browser) live at `http://localhost:3000/ui` while the server is running. The raw OpenAPI document is `GET /doc`.

Default base URL: `http://localhost:3000`.

## Calling the API

Every request and response body is JSON. Send `Content-Type: application/json` on `POST` and `PATCH`.

```ts
const BASE_URL = "http://localhost:3000";

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      // Required only when the server has API_KEY set.
      // "X-Api-Key": import.meta.env.VITE_API_KEY,
      // Send this on every user-scoped call once you have a profile id.
      "X-User-Id": currentUserId,
      ...init.headers,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String(body.error)
        : body && typeof body === "object" && "message" in body
          ? String(body.message)
          : response.statusText;
    throw new Error(message);
  }
  return body as T;
}
```

The server does not send CORS headers. A browser app on another origin (for example Vite on port 5173) cannot call `localhost:3000` directly. Proxy `/api` through the frontend dev server, or call the API from your own backend.

### Identity

Create a profile first and keep `id`. That UUID is the user for every other call.

Prefer the `X-User-Id` header. You can also pass `userId` in the query string or JSON body. If you send both, they must be the same string, or the API returns `400`.

Seeded demo user (after `supabase/seed/seed.sql`): `00000000-0000-0000-0000-000000000001`.

### API key

`/`, `/health`, `/doc`, and `/ui` are public. Every other route requires `X-Api-Key` **only when** the server was started with `API_KEY` set. A missing or wrong key is `401`:

```json
{ "error": "Unauthorized: missing or invalid X-Api-Key" }
```

Local demos usually leave `API_KEY` unset, so the header is optional.

### Errors

| Status | When | Body |
|--------|------|------|
| `400` | Invalid JSON, failed validation, or missing / mismatched user id | `{ "error": "..." }` |
| `401` | `API_KEY` is set and `X-Api-Key` does not match | `{ "error": "..." }` |
| `404` | Profile or recipe does not exist | `{ "error": "..." }` |
| `404` | Path does not exist | `{ "message": "Not Found - /the/path" }` |
| `500` | Server or database failure | `{ "error": "..." }` or `{ "message": "..." }` |

Validation messages from several fields are joined with `"; "`.

### Field names

Responses use snake_case (`display_name`, `ready_in_minutes`, `constraint_type`). Request bodies are mixed:

- Profiles use camelCase: `displayName`, `email`.
- Constraints, preferences, and feedback use snake_case: `constraint_type`, `preference_type`, `recipeId` is camelCase.

## Screen flow

1. `POST /api/profiles` and store `id`.
2. `POST /api/constraints` for allergies, diet, and ingredients the user will not eat. These are hard filters. Matching recipes never appear in recommendations.
3. Optionally `POST /api/preferences` for tastes (cuisine, spice, and so on). Weights are soft: higher scores rank a recipe up, negative scores rank it down.
4. `GET /api/recommendations` for the home feed. Each item is `{ recipe, score }`.
5. `GET /api/recipes/{recipeId}` for the detail screen (ingredients and attributes).
6. `POST /api/feedback` after a rating, like, or comment. The next recommendations call already reflects the updated weights.
7. `POST /api/generate` when the user wants a new recipe written for them, or `POST /api/agent/chat` for a conversation that can recommend, generate, and record feedback.

`GET /api/recommendations` writes a history row for every recipe it returns. Refreshing the feed appends history. It does not change scores by itself.

## Profiles

### Create

`POST /api/profiles` → `201`

```json
{ "displayName": "Aya", "email": "aya@example.com" }
```

`email` is optional.

```json
{
  "id": "3f1c2a40-7b2e-4d1a-9c11-0a1b2c3d4e5f",
  "display_name": "Aya",
  "email": "aya@example.com",
  "created_at": "2026-09-22T17:00:00.000Z",
  "updated_at": "2026-09-22T17:00:00.000Z"
}
```

Use `id` as `X-User-Id` from here on.

### Read

`GET /api/profiles/{userId}` → `200` with the same profile object, or `404` `{ "error": "Profile not found" }`.

### Update

`PATCH /api/profiles/{userId}` → `200`

Send only the fields that change. `email: null` clears it.

```json
{ "displayName": "Aya K." }
```

## Constraints

Hard rules. A recipe that contains an allergy or excluded ingredient, or that fails the user's diet, is removed before scoring.

`constraint_type` is one of:

| Value | Meaning | Example `value` |
|-------|---------|-----------------|
| `allergy` | Ingredient substring to exclude | `"peanut"` |
| `excluded_ingredient` | Same matching rule as allergy | `"cilantro"` |
| `diet` | Recipe must match | `"vegan"`, `"vegetarian"`, `"gluten_free"`, `"gluten-free"`, `"dairy_free"`, `"dairy-free"`, or a diet category name |

Allergy and excluded-ingredient checks are case-insensitive substrings of ingredient names. If the user has several diet constraints, a recipe is kept when it matches **any** of them.

### List

`GET /api/constraints` → `200`

```json
[
  {
    "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "constraint_type": "allergy",
    "value": "peanut"
  }
]
```

### Add or replace

`POST /api/constraints` → `201`

Same `(constraint_type, value)` for a user updates the existing row instead of creating a duplicate.

```json
{
  "constraint_type": "diet",
  "value": "vegetarian"
}
```

`userId` in the body is optional when `X-User-Id` is set.

### Delete

`DELETE /api/constraints/{constraintId}` → `200`

```json
{ "status": "ok" }
```

The constraint must belong to the current user.

## Preferences

Soft weights used only for ranking. Range is **-5 to 5**. Feedback later nudges these by 0.5 and clamps them to that same range, so a single comment cannot take over the ranking.

`preference_type` is one of: `cuisine`, `ingredient`, `spice_level`, `meal_type`, `prep_time`, `texture`.

`value` is a free string that should match recipe attributes (for example `"italian"`, `"high"`, `"dinner"`). The score of a recipe is the sum of the user's weights for each attribute that recipe has. Unknown attributes add 0.

### List

`GET /api/preferences` → `200`, highest weight first.

```json
[
  { "preference_type": "cuisine", "value": "italian", "weight": 2.5 }
]
```

### Set

`POST /api/preferences` → `201`

Upserts on `(preference_type, value)`.

```json
{
  "preference_type": "cuisine",
  "value": "italian",
  "weight": 2
}
```

### Delete

`DELETE /api/preferences?preference_type=cuisine&value=italian` → `200`

```json
{ "status": "ok" }
```

`preference_type` and `value` are required query params. URL-encode `value`.

## Recipes

Catalog browse. This is not personalized. Use recommendations for the ranked feed.

### List

`GET /api/recipes?limit=20&offset=0` → `200`

`limit` defaults to 50 (max 100). `offset` defaults to 0. Results are ordered by title.

```json
[
  {
    "id": "b1000000-0000-0000-0000-000000000001",
    "external_id": "716429",
    "source_api": "spoonacular",
    "title": "Pasta with Garlic",
    "image_url": "https://example.com/pasta.jpg",
    "ready_in_minutes": 25,
    "servings": 2,
    "calories": 540,
    "protein_g": 18,
    "carbs_g": 70,
    "fat_g": 16,
    "vegan": false,
    "vegetarian": true,
    "gluten_free": false,
    "dairy_free": false
  }
]
```

List rows can also include `created_at`. Rely on the fields above.

### Detail

`GET /api/recipes/{recipeId}` → `200`, or `404` `{ "error": "Recipe not found" }`.

```json
{
  "recipe": { "id": "b1000000-0000-0000-0000-000000000001", "title": "Pasta with Garlic" },
  "attributes": [
    { "attribute_type": "cuisine", "attribute_value": "italian" },
    { "attribute_type": "spice_level", "attribute_value": "mild" }
  ],
  "ingredients": [
    { "name": "spaghetti", "amount": "200 g" },
    { "name": "garlic", "amount": "3 cloves" }
  ]
}
```

`recipe` has the same fields as a list item. `amount` may be `null`.

Catalog ingest (`POST /api/recipes/ingest/ids`, `/random`, `/search`) fills the database from Spoonacular. A meal-planning UI does not need those routes.

## Recommendations

`GET /api/recommendations?limit=5` → `200`

`limit` defaults to 10. Omit `userId` when `X-User-Id` is set.

```json
[
  {
    "recipe": {
      "id": "b1000000-0000-0000-0000-000000000001",
      "external_id": null,
      "source_api": "seed",
      "title": "Pasta with Garlic",
      "image_url": null,
      "ready_in_minutes": 25,
      "servings": 2,
      "calories": 540,
      "protein_g": 18,
      "carbs_g": 70,
      "fat_g": 16,
      "vegan": false,
      "vegetarian": true,
      "gluten_free": false,
      "dairy_free": false
    },
    "score": 3.5
  }
]
```

Order is score descending. An empty array means nothing in the catalog passed the user's constraints, or the catalog is empty. `score` can be 0 when the user has no matching preferences yet.

Show `title`, `image_url`, `ready_in_minutes`, and `calories` on cards. Pass `recipe.id` to the detail and feedback calls.

## Feedback

`POST /api/feedback` → `201`

```json
{
  "recipeId": "b1000000-0000-0000-0000-000000000001",
  "rating": 4,
  "liked": true,
  "comment": "I liked the flavor, but it was too spicy."
}
```

`recipeId` is required. `rating` (1–5), `liked`, and `comment` are all optional. Send at least one of them or the row is stored and preferences stay unchanged.

```json
{ "status": "ok" }
```

What changes preferences:

- A `comment` is read for tastes (cuisine, spice, and the other preference types). Valid signals move the matching weight by 0.5 up or down.
- With no comment, `liked: true` nudges every attribute on that recipe up, and `liked: false` nudges them down.
- With no comment and no `liked`, a rating of 1–2 is negative, 3 does nothing, and 4–5 is positive.

`201` means the feedback was saved. If comment parsing fails, preferences are left as they were and the call still succeeds. Refetch `GET /api/preferences` if the settings screen shows weights.

## History

Both endpoints take `limit` (default 20, max 100) and return newest first.

### What was shown

`GET /api/history/recommendations?limit=20` → `200`

```json
[
  {
    "id": "c2000000-0000-0000-0000-000000000001",
    "recipe_id": "b1000000-0000-0000-0000-000000000001",
    "context": "daily_recommendation",
    "score": 3.5,
    "shown_at": "2026-09-22T17:05:00.000Z",
    "recipe": {
      "id": "b1000000-0000-0000-0000-000000000001",
      "title": "Pasta with Garlic",
      "image_url": null,
      "calories": 540,
      "ready_in_minutes": 25
    }
  }
]
```

`recipe` can be `null` if the recipe was deleted. When present it may only include a subset of recipe fields, so null-check nutrition and diet flags before rendering them.

### Past feedback

`GET /api/history/feedback?limit=20` → `200`

```json
[
  {
    "id": "d3000000-0000-0000-0000-000000000001",
    "recipe_id": "b1000000-0000-0000-0000-000000000001",
    "rating": 4,
    "liked": true,
    "comment": "Too spicy",
    "created_at": "2026-09-22T17:06:00.000Z"
  }
]
```

`rating`, `liked`, and `comment` are `null` when the user did not send them.

## Generated recipes

These are new recipes written for one user. They are **not** added to `GET /api/recipes` or the recommendation feed. List them with `GET /api/generate`.

### Create

`POST /api/generate` → `201`

`prompt` is optional. With no prompt, the model invents a meal that fits the user's constraints and preferences.

```json
{ "prompt": "quick high-protein lunch" }
```

```json
{
  "id": "e4000000-0000-0000-0000-000000000001",
  "user_id": "3f1c2a40-7b2e-4d1a-9c11-0a1b2c3d4e5f",
  "title": "Lemon herb chicken bowl",
  "ingredients": [
    { "name": "chicken breast", "amount": "200 g" }
  ],
  "steps": ["Season the chicken.", "Sear until cooked through."],
  "tags": [{ "type": "meal_type", "value": "lunch" }],
  "calories": 480,
  "ready_in_minutes": 20,
  "servings": 1,
  "is_valid": true,
  "created_at": "2026-09-22T17:10:00.000Z"
}
```

`amount`, `calories`, `ready_in_minutes`, and `servings` may be omitted or `null`. This call uses a model, so it is slower than the recommendation feed. Show a loading state.

### List

`GET /api/generate?limit=20` → `200`

`limit` defaults to 20 (max 50). Same object as create, as an array, newest first.

## Chat

`POST /api/agent/chat` → `200`

The **backend owns conversation history**. Send only the latest user message and
reuse `sessionId` from the previous response. Do **not** manage a full transcript
on the client.

```json
{
  "message": "What should I eat today?",
  "sessionId": "11111111-1111-4111-8111-111111111111",
  "userId": "00000000-0000-4000-8000-000000000001"
}
```

Omit `sessionId` on the first turn — the server creates one and returns it.

Also accepted (legacy): `{ "messages": [ ... ] }` — only the latest `user` turn
is used; history still lives on the server under `sessionId`.

```json
{
  "text": "Here are a few ideas...",
  "sessionId": "11111111-1111-4111-8111-111111111111",
  "lastAnswer": "Here are a few ideas...",
  "activeAgentId": "nutrition-agent",
  "lastAnswerAgentId": "nutrition-agent",
  "toolCalls": [],
  "messages": [
    { "role": "user", "content": "What should I eat today?" },
    { "role": "assistant", "content": "Here are a few ideas..." }
  ]
}
```

Render `text`. Persist **`sessionId`** for the next request. If the session is
bound to a user, every follow-up must send the same `X-User-Id` (or matching
`userId`) or the API returns `403`. `lastAnswer` is what the router uses to
interpret short replies like "yes" / "skip". `messages` is optional UI sugar
(recent window only).

Chat does not replace the recommendation endpoint. Use `GET /api/recommendations`
when you need structured cards. Use chat when the user is typing.

## Quick reference

| Method | Path | Needs user | Success |
|--------|------|------------|---------|
| `GET` | `/health` | no | `200` `{ "status": "ok" }` |
| `POST` | `/api/profiles` | no | `201` profile |
| `GET` | `/api/profiles/{userId}` | path id | `200` profile |
| `PATCH` | `/api/profiles/{userId}` | path id | `200` profile |
| `GET` | `/api/constraints` | yes | `200` constraint[] |
| `POST` | `/api/constraints` | yes | `201` constraint |
| `DELETE` | `/api/constraints/{constraintId}` | yes | `200` `{ "status": "ok" }` |
| `GET` | `/api/preferences` | yes | `200` preference[] |
| `POST` | `/api/preferences` | yes | `201` preference |
| `DELETE` | `/api/preferences` | yes | `200` `{ "status": "ok" }` |
| `GET` | `/api/recipes` | no | `200` recipe[] |
| `GET` | `/api/recipes/{recipeId}` | no | `200` detail |
| `GET` | `/api/recommendations` | yes | `200` `{ recipe, score }[]` |
| `POST` | `/api/feedback` | yes | `201` `{ "status": "ok" }` |
| `GET` | `/api/history/recommendations` | yes | `200` history[] |
| `GET` | `/api/history/feedback` | yes | `200` feedback[] |
| `POST` | `/api/generate` | yes | `201` generated recipe |
| `GET` | `/api/generate` | yes | `200` generated recipe[] |
| `POST` | `/api/agent/chat` | prefer `X-User-Id` | `200` `{ text, sessionId, lastAnswer, activeAgentId }` |
