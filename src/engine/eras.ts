// Era looks: skirt silhouettes from each decade, as presets of the styling choices. Every look is
// drafted to the person's own measurements like any other style; picking one just sets the shape,
// length and fit, which can still be changed afterwards.
import type { Fit, Length, Silhouette } from './skirt';

interface EraLook {
  id: string;
  name: string;
  about: string;
  fabric: string;
  silhouette: Silhouette;
  length: Length;
  fit: Fit;
}

interface Era {
  id: string;
  name: string;
  years: string;
  about: string;
  looks: EraLook[];
}

export const ERAS: Era[] = [
  {
    id: 'edwardian',
    name: 'Edwardian',
    years: '1900–1914',
    about: 'Long and smooth over the hips, sweeping out at the hem.',
    looks: [
      {
        id: 'edwardian_walking',
        name: 'Edwardian walking skirt',
        about: 'Fitted through the hips, then flares into a sweeping floor-length hem.',
        fabric: 'Wool suiting, linen or heavy cotton',
        silhouette: 'trumpet',
        length: 'maxi',
        fit: 'fitted',
      },
      {
        id: 'edwardian_day',
        name: 'Edwardian day skirt',
        about: 'A plainer long skirt that widens gently all the way down.',
        fabric: 'Cotton twill, linen or wool',
        silhouette: 'a_line',
        length: 'maxi',
        fit: 'regular',
      },
    ],
  },
  {
    id: '1920s',
    name: '1920s',
    years: '1920–1929',
    about: 'Straight and loose, with the hem rising toward the knee.',
    looks: [
      {
        id: '1920s_flapper',
        name: 'Flapper skirt',
        about: 'A straight, easy skirt to just below the knee, made for moving.',
        fabric: 'Crepe, silk-like satin or fine wool',
        silhouette: 'straight',
        length: 'knee',
        fit: 'relaxed',
      },
      {
        id: '1920s_early',
        name: 'Early twenties skirt',
        about: 'The same straight line at calf length, as worn before hems rose.',
        fabric: 'Wool crepe or linen',
        silhouette: 'straight',
        length: 'midi',
        fit: 'relaxed',
      },
    ],
  },
  {
    id: '1930s',
    name: '1930s',
    years: '1930–1939',
    about: 'Slim over the hips, with a soft flare at the calf.',
    looks: [
      {
        id: '1930s_flared',
        name: 'Thirties flared skirt',
        about: 'Close-fitting to below the hip, with a fluted flare from the knee.',
        fabric: 'Rayon crepe, satin or fine wool',
        silhouette: 'trumpet',
        length: 'midi',
        fit: 'fitted',
      },
      {
        id: '1930s_evening',
        name: 'Thirties evening skirt',
        about: 'The fluted shape at full length, for evening.',
        fabric: 'Satin, crepe-back satin or velvet',
        silhouette: 'trumpet',
        length: 'maxi',
        fit: 'fitted',
      },
    ],
  },
  {
    id: '1940s',
    name: '1940s',
    years: '1940–1949',
    about: 'Neat, knee-length and sparing with fabric.',
    looks: [
      {
        id: '1940s_utility',
        name: 'Utility A-line',
        about: 'A trim A-line to the knee, the wartime everyday skirt.',
        fabric: 'Wool flannel, tweed or cotton gabardine',
        silhouette: 'a_line',
        length: 'knee',
        fit: 'fitted',
      },
      {
        id: '1940s_slim',
        name: 'Forties slim skirt',
        about: 'A slim skirt that narrows slightly to the knee.',
        fabric: 'Wool suiting or gabardine',
        silhouette: 'pencil',
        length: 'knee',
        fit: 'regular',
      },
    ],
  },
  {
    id: '1950s',
    name: '1950s',
    years: '1950–1959',
    about: 'A neat waist with either a full circle skirt or a curvy wiggle skirt.',
    looks: [
      {
        id: '1950s_circle',
        name: 'Fifties circle skirt',
        about: 'A full circle at tea length that swings out when you turn.',
        fabric: 'Cotton poplin, cotton sateen or felt',
        silhouette: 'circle',
        length: 'midi',
        fit: 'regular',
      },
      {
        id: '1950s_swing',
        name: 'Swing skirt',
        about: 'A half circle to the knee: full, but lighter than the full circle.',
        fabric: 'Cotton poplin or lightweight wool',
        silhouette: 'half_circle',
        length: 'knee',
        fit: 'regular',
      },
      {
        id: '1950s_wiggle',
        name: 'Wiggle skirt',
        about: 'Close-fitting and tapered to the knee, with a walking slit at the back.',
        fabric: 'Stretch cotton sateen or wool suiting',
        silhouette: 'pencil',
        length: 'knee',
        fit: 'fitted',
      },
    ],
  },
  {
    id: '1960s',
    name: '1960s',
    years: '1960–1969',
    about: 'Short and simple, from A-line minis to swingy skaters.',
    looks: [
      {
        id: '1960s_mod',
        name: 'Mod mini',
        about: 'A crisp A-line well above the knee.',
        fabric: 'Wool crepe, cotton drill or bonded fabric',
        silhouette: 'a_line',
        length: 'mini',
        fit: 'regular',
      },
      {
        id: '1960s_skater',
        name: 'Skater mini',
        about: 'A half circle mini that flips out as you move.',
        fabric: 'Cotton poplin or light wool',
        silhouette: 'half_circle',
        length: 'mini',
        fit: 'regular',
      },
    ],
  },
  {
    id: '1970s',
    name: '1970s',
    years: '1970–1979',
    about: 'Long and flowing, or flared from the hip to mid-calf.',
    looks: [
      {
        id: '1970s_boho',
        name: 'Boho maxi',
        about: 'An easy A-line to the ankle.',
        fabric: 'Cotton lawn, cheesecloth or printed rayon',
        silhouette: 'a_line',
        length: 'maxi',
        fit: 'relaxed',
      },
      {
        id: '1970s_flared',
        name: 'Seventies flared midi',
        about: 'A half circle to mid-calf, with lots of movement at the hem.',
        fabric: 'Corduroy, denim or rayon',
        silhouette: 'half_circle',
        length: 'midi',
        fit: 'regular',
      },
    ],
  },
  {
    id: '1980s',
    name: '1980s',
    years: '1980–1989',
    about: 'Strong shapes: sharp pencil skirts and full ra-ra minis.',
    looks: [
      {
        id: '1980s_power',
        name: 'Power pencil',
        about: 'A sharp, fitted pencil skirt just above the knee.',
        fabric: 'Wool suiting or stretch twill',
        silhouette: 'pencil',
        length: 'above_knee',
        fit: 'fitted',
      },
      {
        id: '1980s_rara',
        name: 'Ra-ra mini',
        about: 'A full circle mini with plenty of bounce.',
        fabric: 'Cotton poplin or taffeta',
        silhouette: 'circle',
        length: 'mini',
        fit: 'regular',
      },
    ],
  },
  {
    id: '1990s',
    name: '1990s',
    years: '1990–1999',
    about: 'Pared back: slinky slip skirts and simple minis.',
    looks: [
      {
        id: '1990s_slip',
        name: 'Slip skirt',
        about: 'Skims the hips and flutters out a little at mid-calf.',
        fabric: 'Satin, crepe de chine or viscose',
        silhouette: 'trumpet',
        length: 'midi',
        fit: 'regular',
      },
      {
        id: '1990s_mini',
        name: 'Nineties mini',
        about: 'A plain, close-fitting straight mini.',
        fabric: 'Denim, suiting or stretch twill',
        silhouette: 'straight',
        length: 'mini',
        fit: 'fitted',
      },
    ],
  },
];

export const LOOKS: EraLook[] = ERAS.flatMap((e) => e.looks);

export const findLook = (id: string | undefined) => LOOKS.find((l) => l.id === id);
