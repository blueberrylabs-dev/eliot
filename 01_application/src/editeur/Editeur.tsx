// Le composant principal : il assemble la barre du haut, le rail et son panneau, la barre
// contextuelle et la zone de travail.

import { BarreContexte } from "./BarreContexte";
import { BarreHaut } from "./BarreHaut";
import { BarreLaterale } from "./BarreLaterale";
import { Notification } from "./Notification";
import { useRaccourcis } from "./raccourcis";
import { ZoneDeTravail } from "./ZoneDeTravail";

export function Editeur() {
  useRaccourcis();
  return (
    <div className="relative flex h-full flex-col">
      <BarreHaut />
      <div className="flex min-h-0 flex-1">
        <BarreLaterale />
        <main className="flex min-w-0 flex-1 flex-col">
          <BarreContexte />
          <ZoneDeTravail />
        </main>
      </div>
      <Notification />
    </div>
  );
}
