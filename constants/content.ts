import { Ionicons } from '@expo/vector-icons';

export type WorkingHours = {
  label: string;
  value: string;
};

export type Review = {
  id: string;
  author: string;
  comment: string;
  rating: number;
  date: string;
};

export type ContactInfo = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export type Story = {
  id: string;
  userName: string;
  avatar: string;
  image: string;
  text: string;
  postId: string;
};

export type NumericValue = number | string;

export type Post = {
  id: string;
  user: string;
  userAvatar: string;
  userHandle: string;
  place: string;
  address: string;
  image: string;
  gallery: string[];
  likes: NumericValue;
  totalLikes: NumericValue;
  followers: NumericValue;
  rating: number;
  tags: string[];
  bio: string;
  workingHours: WorkingHours[];
  reviews: Review[];
  contact: ContactInfo[];
};

export type NormalizedPost = Omit<Post, 'likes' | 'totalLikes' | 'followers'> & {
  uid: string;
  likes: number;
  totalLikes: number;
  followers: number;
};

export function parseNumericValue(value: NumericValue): number {
  if (typeof value === 'number') {
    return value;
  }

  let str = value.toString().trim().toLowerCase();
  str = str.replace(/\s+/g, '').replace(',', '.');

  let multiplier = 1;
  if (str.includes('млн')) {
    multiplier = 1_000_000;
    str = str.replace('млн', '');
  } else if (str.includes('тыс')) {
    multiplier = 1_000;
    str = str.replace('тыс', '');
  } else if (str.endsWith('k')) {
    multiplier = 1_000;
    str = str.slice(0, -1);
  }

  const parsed = Number.parseFloat(str);
  if (Number.isFinite(parsed)) {
    return parsed * multiplier;
  }
  return 0;
}

export function normalizePost(post: Post, index = 0): NormalizedPost {
  return {
    ...post,
    uid: `${post.id}-${index}`,
    likes: parseNumericValue(post.likes),
    totalLikes: parseNumericValue(post.totalLikes),
    followers: parseNumericValue(post.followers)
  };
}

export function normalizePosts(list: Post[]): NormalizedPost[] {
  return list.map((post, index) => normalizePost(post, index));
}

export function formatCompactNumber(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  const formatWithSuffix = (num: number, suffix: string) => {
    const fixed = num.toFixed(1);
    const normalized = fixed.replace(/\.0$/, '').replace('.', ',');
    return `${sign}${normalized} ${suffix}`;
  };

  if (abs >= 1_000_000) {
    return formatWithSuffix(abs / 1_000_000, 'млн');
  }

  if (abs >= 1_000) {
    return formatWithSuffix(abs / 1_000, 'тыс');
  }

  return new Intl.NumberFormat('ru-RU').format(value);
}

export const posts: Post[] = [

];

export const stories: Story[] = [


  ];
