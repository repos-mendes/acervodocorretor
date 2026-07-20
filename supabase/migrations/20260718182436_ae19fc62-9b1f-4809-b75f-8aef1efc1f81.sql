
-- covers, galleries, materials: admin manages; active users read
CREATE POLICY "Active users read covers" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'covers' AND public.is_active_user(auth.uid()));
CREATE POLICY "Admins write covers" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'covers' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'covers' AND public.is_admin(auth.uid()));

CREATE POLICY "Active users read galleries" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'galleries' AND public.is_active_user(auth.uid()));
CREATE POLICY "Admins write galleries" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'galleries' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'galleries' AND public.is_admin(auth.uid()));

CREATE POLICY "Active users read materials" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'materials' AND public.is_active_user(auth.uid()));
CREATE POLICY "Admins write materials" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'materials' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'materials' AND public.is_admin(auth.uid()));

-- avatars: user manages own folder (path prefix = user id)
CREATE POLICY "Users read all avatars" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
CREATE POLICY "Users manage own avatar" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
