import { v4 as uuidv4 } from 'uuid';

interface UserData {
  uid: string;
  pa: string;  // public address
  ct: number;  // claim count
}

const USER_DATA_KEY = 'faucet_user_data';

export const getUserId = (): string => {
  const userData = getUserData();
  
  if (userData && userData.uid) {
    return userData.uid;
  }
  
  const newUuid = uuidv4();
  
  const initialUserData: UserData = {
    uid: newUuid,
    pa: '',
    ct: 0
  };
  
  localStorage.setItem(USER_DATA_KEY, JSON.stringify(initialUserData));
  return newUuid;
};

export const getUserData = (): UserData | null => {
  try {
    const data = localStorage.getItem(USER_DATA_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
};

export const updateClaimData = (publicAddress: string): void => {
  const userData = getUserData();
  
  if (userData) {
    userData.pa = publicAddress;
    userData.ct += 1;
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
  }
};

export const canMakeClaim = (): boolean => {
  const userData = getUserData();
  return !userData || userData.ct < 10;
};

export const getClaimCount = (): number => {
  const userData = getUserData();
  return userData ? userData.ct : 0;
};

export const resetUserData = (): void => {
  localStorage.removeItem(USER_DATA_KEY);
}; 