Suivi Parage v4.0.34

- Correction de l’erreur de synchronisation liée au dépassement du quota localStorage sur les gros historiques/photos.
- Les données complètes des chantiers sont désormais conservées dans IndexedDB (stockage navigateur de grande capacité), le cloud Supabase restant la sauvegarde partagée.
- localStorage ne conserve qu’une copie allégée pour le démarrage.
- Comptabilité : seuls les chantiers réels non encore transmis sont cochés par défaut. Les historiques importés ne le sont plus.
- Ajout du bouton « Tout décocher ».
