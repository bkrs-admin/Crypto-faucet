import styles from './page.module.css';
import FaucetUI from './components/FaucetUI';

export default function Home() {
  return (
    <main className={styles.main}>
      <FaucetUI />
    </main>
  );
}
