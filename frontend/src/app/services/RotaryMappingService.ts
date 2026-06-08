export interface MappingPoint {
  angle: number;
  value: string;
}

export class RotaryMappingService {
  private static readonly MAPPING_POINTS: MappingPoint[] = [
    { angle: -35, value: "DAE" },
    { angle: 0, value: "ARRET" },
    { angle: 35, value: "Moniteur" },
    { angle: 60, value: "1-10" },
    { angle: 75, value: "15" },
    { angle: 90, value: "20" },
    { angle: 105, value: "30" },
    { angle: 120, value: "50" },
    { angle: 135, value: "70" },
    { angle: 150, value: "100" },
    { angle: 165, value: "120" },
    { angle: 180, value: "150" },
    { angle: 195, value: "170" },
    { angle: 210, value: "200" },
    { angle: 240, value: "Stimulateur" },
  ];

  /**
   * Mappe la valeur du rotary (angle) vers la valeur prédéfinie
   */
  static mapRotaryToValue(rotaryAngle: number): string {
    // Trouver le point le plus proche
    let closestPoint = this.MAPPING_POINTS[0];
    let minDifference = Math.abs(rotaryAngle - closestPoint.angle);

    for (const point of this.MAPPING_POINTS) {
      const difference = Math.abs(rotaryAngle - point.angle);
      if (difference < minDifference) {
        minDifference = difference;
        closestPoint = point;
      }
    }

    return closestPoint.value;
  }

  /**
   * Obtient la liste des points de mapping (pour debug ou affichage)
   */
  static getMappingPoints(): MappingPoint[] {
    return [...this.MAPPING_POINTS];
  }

  /**
   * Valide si une valeur est dans la liste des valeurs acceptables
   */
  static isValidValue(value: string): boolean {
    return this.MAPPING_POINTS.some(point => point.value === value);
  }
} 