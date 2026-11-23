import { Component, type ReactNode } from 'react';

/** Une réponse invalide ou un module interrompu ne doit pas produire un écran blanc. */
export default class FrontierePage extends Component<{ children: ReactNode }, { erreur: boolean }> {
  state = { erreur: false };
  static getDerivedStateFromError() { return { erreur: true }; }
  render() {
    if (this.state.erreur) return <div className="etat" role="alert"><h1>Cette page est indisponible</h1><p>Le chargement a été interrompu. Rechargez la page pour réessayer.</p><button className="bouton secondaire" onClick={() => window.location.reload()}>Recharger la page</button></div>;
    return this.props.children;
  }
}
