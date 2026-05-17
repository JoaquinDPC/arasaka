package domain

// DefaultTags is the system-wide list of recognized tag names.
// These are served to clients for autocomplete/discovery; they are not stored per-user.
// A tag only enters user_tags once the user actually uses or creates it.
var DefaultTags = []string{
	"Sueldo", "Freelance", "Bono", "Dividendos", "Devolucion",
	"Arriendo", "Luz", "Agua", "Gas", "Internet", "Condominio",
	"Supermercado", "Restaurante", "Delivery", "Cafe", "Feria",
	"Bencina", "Uber", "Taxi", "Estacionamiento", "Peaje",
	"Netflix", "Spotify", "Amazon", "Youtube", "Icloud",
	"Farmacia", "Medico", "Dentista", "Gym", "Optica",
	"Ropa", "Calzado", "Peluqueria", "Veterinario", "Comida-mascota",
	"Cine", "Bar", "Concierto",
	"Vuelo", "Hotel", "Airbnb",
	"Inversion", "Ahorro", "Transferencia",
}
