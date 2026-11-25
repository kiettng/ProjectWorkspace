-- Keep the private dossier bucket and existing allowlist while enabling .pptx uploads.
update storage.buckets
set allowed_mime_types = array_append(
  allowed_mime_types,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
)
where id = 'dossier'
  and not ('application/vnd.openxmlformats-officedocument.presentationml.presentation' = any(allowed_mime_types));
