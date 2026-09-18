import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFarm } from "../context/useFarm";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import { PlusIcon } from "../components/Icons";

function BreedsPage() {
  const navigate = useNavigate();
  const { breeds, selectedHouse, setConfirmDialog } = useFarm();

  const [searchQuery, setSearchQuery] = useState("");

  const filteredBreeds = breeds.filter((breed) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      breed.name?.toLowerCase().includes(q) ||
      breed.description?.toLowerCase().includes(q)
    );
  });

  const totalBirdsCataloged = filteredBreeds.reduce(
    (sum, b) => sum + (b.numberOfBirds || 0),
    0
  );

  return (
    <div className="breeds-page">
      <PageHeader
        eyebrow={selectedHouse ? `Poultry House: ${selectedHouse.name}` : undefined}
        title="Flock Bird Breeds"
        description="Catalog bird breeds and manage flock populations kept in this poultry house."
        actions={
          <button
            type="button"
            className="primary-button"
            onClick={() => navigate("/breeds/new")}
          >
            <PlusIcon size={14} /> Add Bird Breed
          </button>
        }
      />

      <div className="records-section">
        {/* Toolbar */}
        <div className="section-toolbar">
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder="Search breeds or notes..."
              className="table-filter-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ minWidth: 240 }}
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-filter-btn"
                onClick={() => setSearchQuery("")}
              >
                Clear
              </button>
            )}
          </div>

          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {filteredBreeds.length} breed{filteredBreeds.length === 1 ? "" : "s"} cataloged
          </div>
        </div>

        {filteredBreeds.length === 0 ? (
          <EmptyState
            icon="🐔"
            title={searchQuery ? "No matching breeds found" : "No bird breeds registered"}
            message={
              searchQuery
                ? `No breeds match your search "${searchQuery}".`
                : "No bird breeds have been added to this poultry house yet."
            }
            actionText={searchQuery ? "Clear Search" : "+ Add First Bird Breed"}
            onAction={
              searchQuery
                ? () => setSearchQuery("")
                : () => navigate("/breeds/new")
            }
          />
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Breed Name</th>
                    <th>Number of Birds</th>
                    <th>Date Added</th>
                    <th>Description / Notes</th>
                    <th>Logs</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBreeds.map((breed) => {
                    const houseCapacity = selectedHouse?.birdsPlaced || 1;
                    const percentOfFlock = Math.min(
                      100,
                      ((breed.numberOfBirds / houseCapacity) * 100).toFixed(1)
                    );

                    return (
                      <tr key={breed.id}>
                        <td>
                          <span className="breed-chip" style={{ fontSize: 13, fontWeight: 700 }}>
                            {breed.name}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontSize: 14 }}>{breed.numberOfBirds}</strong> birds
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 11,
                              color: "var(--text-muted)",
                            }}
                          >
                            ({percentOfFlock}% of house)
                          </span>
                        </td>
                        <td>
                          {breed.dateAdded
                            ? new Date(breed.dateAdded).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </td>
                        <td style={{ color: breed.description ? "var(--text-secondary)" : "var(--text-muted)", maxWidth: 320 }}>
                          {breed.description || "—"}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6, fontSize: 11 }}>
                            {breed._count?.birdConditions > 0 && (
                              <span className="badge badge-upcoming" title="Health records referencing this breed">
                                {breed._count.birdConditions} health
                              </span>
                            )}
                            {breed._count?.slaughterPlans > 0 && (
                              <span className="badge badge-due-soon" title="Slaughter plans referencing this breed">
                                {breed._count.slaughterPlans} harvest
                              </span>
                            )}
                            {!breed._count?.birdConditions && !breed._count?.slaughterPlans && (
                              <span style={{ color: "var(--text-muted)" }}>0 logs</span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div
                            className="record-actions"
                            style={{ justifyContent: "flex-end" }}
                          >
                            <button
                              type="button"
                              className="secondary-button"
                              style={{ padding: "4px 10px", fontSize: 12 }}
                              onClick={() => navigate(`/breeds/${breed.id}/edit`)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="danger-button"
                              style={{ padding: "4px 10px", fontSize: 12 }}
                              onClick={() =>
                                setConfirmDialog({
                                  type: "breed",
                                  id: breed.id,
                                  name: breed.name,
                                })
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="records-footer">
              <span>
                Total Breeds: <strong>{filteredBreeds.length}</strong>
              </span>
              <span>
                Total Birds in Breeds: <strong>{totalBirdsCataloged}</strong> birds
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default BreedsPage;
