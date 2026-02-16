let songs = [];

fetch("songs.json")
  .then(res => res.json())
  .then(data => {
    songs = data;
    renderSongs(songs);
  });

function renderSongs(list) {
  const container = document.getElementById("songList");
  container.innerHTML = "";

  list.forEach(song => {
    container.innerHTML += `
      <div class="song">
        <h3>${song.title} - ${song.artist}</h3>
        <p>Key: ${song.key} | Capo: ${song.capo}</p>
      </div>
    `;
  });
}

document.getElementById("search").addEventListener("input", function() {
  let value = this.value.toLowerCase();
  let filtered = songs.filter(song =>
    song.title.toLowerCase().includes(value) ||
    song.artist.toLowerCase().includes(value)
  );
  renderSongs(filtered);
});
