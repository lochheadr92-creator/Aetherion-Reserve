import SpeciesDatabase from '@/components/game/SpeciesDatabase';
import ResearchScreen from '@/components/game/ResearchScreen';
import FinanceScreen from '@/components/game/FinanceScreen';
import AcquisitionScreen from '@/components/game/AcquisitionScreen';

// Single router for the full-screen management modals.
export default function GameModals({ modal, dbSpecies, onClose, onBuy }) {
  switch (modal) {
    case 'db':
      return <SpeciesDatabase initialSpecies={dbSpecies} onClose={onClose} />;
    case 'research':
      return <ResearchScreen onClose={onClose} />;
    case 'finances':
      return <FinanceScreen onClose={onClose} />;
    case 'fieldops':
      return <AcquisitionScreen onClose={onClose} onBuy={onBuy} />;
    default:
      return null;
  }
}
