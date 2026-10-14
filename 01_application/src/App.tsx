// L'application : l'accueil ou l'éditeur, et les notifications par-dessus.

import { Accueil } from "./accueil/Accueil";
import { Editeur } from "./editeur/Editeur";
import { Notification } from "./editeur/Notification";
import { useEditeur } from "./etat/editeur";
import { Reglages } from "./reglages/Reglages";

export function App() {
  const vue = useEditeur((s) => s.vue);
  const reglages = useEditeur((s) => s.reglagesOuverts);
  return (
    <div className="relative h-full">
      {vue === "accueil" ? <Accueil /> : <Editeur />}
      <Notification />
      {reglages && <Reglages />}
    </div>
  );
}
