V4.0.22
Correctif critique : suppression de la boucle de rechargement sur l'écran de connexion.
Cause : le contrôle de version comparait encore la version distante 4.0.21 à une constante locale 4.0.20, déclenchant un rechargement permanent.
Le service worker, le cache et les références de ressources sont désormais alignés sur 4.0.22.
Les données locales et Supabase ne sont pas effacées.
