import Swal from "sweetalert2";

export interface ShockDeliveryData {
  energy: number;
  shockNumber: number;
  frequency: number;
  timestamp?: Date;
}

export class NotificationService {

  static async showShockDelivered(data: ShockDeliveryData): Promise<boolean> {
    const timestamp = data.timestamp || new Date();
    
    const result = await Swal.fire({
      icon: "warning",
      title: "CHOC DÉLIVRÉ",
      html: this.buildShockDeliveredHTML(data, timestamp),
      confirmButtonText: "Continuer",
      confirmButtonColor: "#f59e0b",
      background: "#1f2937",
      color: "#fff",
      width: "500px",
      showClass: {
        popup: "animate__animated animate__zoomIn animate__faster"
      },
      hideClass: {
        popup: "animate__animated animate__zoomOut animate__faster"
      },
      customClass: {
        popup: "border-2 border-orange-500 shadow-2xl",
        title: "text-orange-400 text-xl",
        confirmButton: "bg-orange-500 hover:bg-orange-600 px-6 py-2 rounded-lg font-bold"
      }
    });

    return result.isConfirmed;
  }


  private static buildShockDeliveredHTML(data: ShockDeliveryData, timestamp: Date): string {
    return `
      <div style="text-align: left; font-family: 'Courier New', monospace; background: #111827; padding: 15px; border-radius: 8px; border: 1px solid #f59e0b;">
        <div style="color: #fbbf24; font-size: 16px; margin-bottom: 10px;">
          <strong>🔋 DÉCHARGE ÉLECTRIQUE RÉUSSIE</strong>
        </div>
        <hr style="border-color: #374151; margin: 10px 0;">
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px;">
          <div>
            <p style="margin: 5px 0; color: #fbbf24;"><strong>Énergie:</strong> <span style="color: #fff;">${data.energy} joules</span></p>
            <p style="margin: 5px 0; color: #fbbf24;"><strong>Choc n°:</strong> <span style="color: #fff;">${data.shockNumber}</span></p>
            <p style="margin: 5px 0; color: #fbbf24;"><strong>Heure:</strong> <span style="color: #fff;">${timestamp.toLocaleTimeString("fr-FR")}</span></p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #60a5fa;"><strong>Fréquence:</strong> <span style="color: #fff;">${data.frequency} BPM</span></p>
            <p style="margin: 5px 0; color: #10b981;"><strong>Status:</strong> <span style="color: #fff;">✅ Délivré</span></p>
          </div>
        </div>
        
        <hr style="border-color: #374151; margin: 10px 0;">
        <div style="text-align: center; color: #fbbf24; font-size: 12px;">
          <em>Vérifiez le rythme cardiaque et la réponse du patient</em>
        </div>
      </div>
    `;
  }

  
  static async showChargingStarted(energy: number): Promise<void> {
    await Swal.fire({
      icon: "info",
      title: "🔋 CHARGE EN COURS",
      html: `
        <div style="font-family: 'Courier New', monospace; color: #fbbf24;">
          <p>Charge à <strong>${energy} joules</strong> en cours...</p>
          <p style="font-size: 12px; color: #9ca3af;">Veuillez patienter pendant la charge</p>
        </div>
      `,
      timer: 2000,
      showConfirmButton: false,
      background: "#1f2937",
      color: "#fff",
      customClass: {
        popup: "border-2 border-yellow-500"
      }
    });
  }


  static async showError(message: string): Promise<void> {
    await Swal.fire({
      icon: "error",
      title: "❌ ERREUR",
      text: message,
      confirmButtonText: "OK",
      confirmButtonColor: "#ef4444",
      background: "#1f2937",
      color: "#fff",
      customClass: {
        popup: "border-2 border-red-500"
      }
    });
  }

  static async showSuccess(message: string): Promise<void> {
    await Swal.fire({
      icon: "success",
      title: "✅ SUCCÈS",
      text: message,
      timer: 2000,
      showConfirmButton: false,
      background: "#1f2937",
      color: "#fff",
      customClass: {
        popup: "border-2 border-green-500"
      }
    });
  }
} 