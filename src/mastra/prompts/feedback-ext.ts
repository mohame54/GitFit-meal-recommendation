export const feedbackExtractionPrompt = `
Extract structured preference signals from a user's recipe feedback comment.

Only use these preference_type values:
- cuisine
- ingredient
- spice_level
- meal_type
- prep_time
- texture

polarity is one of "-1" (dislike), "0" (neutral), or "1" (like).

If the comment carries no extractable signal, return a neutral sentiment and an empty attributes array.
Do not include explanations, markdown, or prose outside the structured response.
`;